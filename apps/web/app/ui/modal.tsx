"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

type ModalProps = {
  children: ReactNode;
  description?: string;
  onClose: () => void;
  size?: "default" | "wide";
  title: string;
};

export function Modal({
  children,
  description,
  onClose,
  size = "default",
  title
}: ModalProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        aria-describedby={description ? "modal-description" : undefined}
        aria-labelledby="modal-title"
        aria-modal="true"
        className={`modal${size === "wide" ? " modal-wide" : ""}`}
        role="dialog"
      >
        <header className="modal-header">
          <div>
            <h2 id="modal-title">{title}</h2>
            {description ? (
              <p id="modal-description">{description}</p>
            ) : null}
          </div>
          <button
            aria-label="Закрыть"
            className="icon-button"
            onClick={onClose}
            title="Закрыть"
            type="button"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
