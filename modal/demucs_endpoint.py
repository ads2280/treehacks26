import modal
import os
import re
import subprocess
import urllib.request

app = modal.App("layertune-demucs")

demucs_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg")
    .pip_install("demucs", "torch", "torchaudio", "fastapi[standard]")
    .run_commands(
        # Pre-download htdemucs model weights into the image
        "python -c \"import demucs.pretrained; demucs.pretrained.get_model('htdemucs')\""
    )
)

volume = modal.Volume.from_name("demucs-stems", create_if_missing=True)

STEMS = ["vocals", "drums", "bass", "other"]
JOB_ID_RE = re.compile(r"^[a-zA-Z0-9_-]+$")


@app.function(
    image=demucs_image,
    gpu="T4",
    timeout=180,
    volumes={"/stems": volume},
    keep_warm=1,
)
@modal.fastapi_endpoint(method="POST")
def separate(request: dict):
    from fastapi.responses import JSONResponse

    audio_url = request.get("audio_url")
    job_id = request.get("job_id")

    if not audio_url or not job_id:
        return JSONResponse({"error": "audio_url and job_id required"}, status_code=400)

    if not isinstance(audio_url, str) or not isinstance(job_id, str):
        return JSONResponse(
            {"error": "audio_url and job_id must be strings"}, status_code=400
        )

    if not JOB_ID_RE.match(job_id):
        return JSONResponse(
            {"error": "job_id contains invalid characters"}, status_code=400
        )

    input_dir = f"/tmp/demucs_input/{job_id}"
    output_dir = f"/tmp/demucs_output/{job_id}"
    os.makedirs(input_dir, exist_ok=True)
    os.makedirs(output_dir, exist_ok=True)

    input_path = os.path.join(input_dir, "input.mp3")

    try:
        urllib.request.urlretrieve(audio_url, input_path)
    except Exception as e:
        return JSONResponse(
            {"error": f"Failed to download audio: {e}"}, status_code=400
        )

    try:
        subprocess.run(
            [
                "python",
                "-m",
                "demucs",
                "-n",
                "htdemucs",
                "--out",
                output_dir,
                input_path,
            ],
            check=True,
            capture_output=True,
        )
    except subprocess.CalledProcessError as e:
        return JSONResponse(
            {"error": f"Demucs separation failed: {e.stderr.decode()[-500:]}"},
            status_code=500,
        )

    stem_dir = os.path.join(output_dir, "htdemucs", "input")
    persist_dir = f"/stems/{job_id}"
    os.makedirs(persist_dir, exist_ok=True)

    result = {}
    for stem_name in STEMS:
        src = os.path.join(stem_dir, f"{stem_name}.wav")
        if os.path.exists(src):
            dst = os.path.join(persist_dir, f"{stem_name}.wav")
            with open(src, "rb") as sf, open(dst, "wb") as df:
                df.write(sf.read())
            result[stem_name] = f"{job_id}/{stem_name}.wav"

    volume.commit()
    return {"job_id": job_id, "stems": result}


@app.function(
    image=modal.Image.debian_slim().pip_install("fastapi[standard]"),
    volumes={"/stems": volume},
)
@modal.fastapi_endpoint(method="GET")
def get_stem(job_id: str, stem: str):
    from fastapi.responses import JSONResponse, FileResponse

    if not JOB_ID_RE.match(job_id) or not JOB_ID_RE.match(stem):
        return JSONResponse({"error": "Invalid job_id or stem name"}, status_code=400)

    volume.reload()
    path = f"/stems/{job_id}/{stem}.wav"
    if not os.path.exists(path):
        return JSONResponse({"error": "Stem not found"}, status_code=404)
    return FileResponse(path, media_type="audio/wav")
