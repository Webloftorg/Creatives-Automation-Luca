'use client';

import { useCallback } from 'react';

interface FileUploadProps {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  label?: string;
}

export function FileUpload({ onFiles, accept = 'image/*', multiple = true, label = 'Drag & Drop oder klicken' }: FileUploadProps) {
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    onFiles(files);
  }, [onFiles]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    onFiles(files);
  }, [onFiles]);

  return (
    <label
      className="flex flex-col items-center justify-center w-full h-32 border border-dashed border-[#444] rounded-lg cursor-pointer hover:border-[#FF4500] transition-colors bg-[#111]"
      onDrop={handleDrop}
      onDragOver={e => e.preventDefault()}
    >
      <span className="text-[#555] text-sm">{label}</span>
      <input type="file" className="hidden" accept={accept} multiple={multiple} onChange={handleChange} />
    </label>
  );
}
