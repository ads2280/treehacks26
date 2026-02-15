import { describe, it, expect, vi } from 'vitest';
import { downloadBlob, audioBufferToWav } from '../audio-utils';

describe('audio-utils', () => {
  it('audioBufferToWav creates a wav blob', () => {
    const buffer = new ArrayBuffer(100);
    const blob = audioBufferToWav(buffer);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('audio/wav');
  });

  it('downloadBlob creates and clicks an anchor', () => {
    const blob = new Blob(['test'], { type: 'text/plain' });
    const clickSpy = vi.fn();
    const mockAnchor = {
      href: '',
      download: '',
      click: clickSpy,
    } as unknown as HTMLAnchorElement;
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor);
    const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    downloadBlob(blob, 'test.wav');

    expect(clickSpy).toHaveBeenCalled();
    expect(createElementSpy).toHaveBeenCalledWith('a');

    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
  });
});
