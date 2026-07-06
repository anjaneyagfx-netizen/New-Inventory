import React from 'react';
import { Dialog, DialogContent } from './ui/dialog';
import { X } from 'lucide-react';

const ImagePreviewModal = ({ isOpen, onClose, imageUrl, altText }) => (
  <Dialog open={isOpen} onOpenChange={onClose}>
    <DialogContent className="max-w-3xl p-2 sm:p-4 bg-background">
      <div className="flex justify-end">
        <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-md hover:bg-muted transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      {imageUrl ? (
        <img src={imageUrl} alt={altText || 'Preview'} className="w-full max-h-[75vh] object-contain rounded-lg" />
      ) : (
        <div className="h-64 flex items-center justify-center text-muted-foreground">No image</div>
      )}
    </DialogContent>
  </Dialog>
);

export default ImagePreviewModal;
