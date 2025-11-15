import React, { useEffect, useRef, ReactNode } from 'react';

// FIX: Define and export MenuItem type to be used by App.tsx for building the context menu.
export type MenuItem =
  | {
      label: string;
      icon: ReactNode;
      onClick?: () => void;
      shortcut?: string;
      className?: string;
      type?: 'item';
    }
  | {
      type: 'divider';
    };

// FIX: Update ContextMenuProps to accept a generic array of menu items.
interface ContextMenuProps {
  items: MenuItem[];
  top: number;
  left: number;
  onClose: () => void;
}

// FIX: Refactor ContextMenu to be a generic component that renders items passed via props.
// This makes it reusable for canvas, node, and group context menus defined in App.tsx.
export const ContextMenu: React.FC<ContextMenuProps> = ({ items, top, left, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Check that the click target is a DOM Node before calling `contains`
            if (menuRef.current && event.target instanceof Node && !menuRef.current.contains(event.target)) {
                onClose();
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
          if(event.key === 'Escape') {
            onClose();
          }
        }
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
          document.removeEventListener('mousedown', handleClickOutside);
          document.removeEventListener('keydown', handleKeyDown);
        }
    }, [onClose]);

    return (
        <div
            ref={menuRef}
            style={{ top, left }}
            className="absolute z-50 bg-neutral-800 border border-neutral-700 rounded-md shadow-lg py-1 w-56 text-sm animate-fade-in-fast"
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
        >
            {items.map((item, index) => {
                if (item.type === 'divider') {
                    return <div key={`divider-${index}`} className="h-px bg-neutral-700/60 my-1" />;
                }
                
                const { label, icon, onClick, shortcut, className } = item;
                const isDisabled = !onClick;

                const baseItemClasses = "w-full text-left flex items-center justify-between px-3 py-2 transition-colors";
                const activeItemClasses = "text-neutral-200 hover:bg-neutral-700";
                const disabledItemClasses = "text-neutral-500 cursor-not-allowed";

                const finalClassName = `${baseItemClasses} ${isDisabled ? disabledItemClasses : activeItemClasses} ${className || ''}`;

                return (
                    <button
                        key={`${label}-${index}`}
                        onClick={() => {
                            if (onClick) {
                                onClick();
                                onClose();
                            }
                        }}
                        disabled={isDisabled}
                        className={finalClassName}
                    >
                        <div className="flex items-center space-x-3">
                            <div className="w-4 h-4 flex items-center justify-center">{icon}</div>
                            <span>{label}</span>
                        </div>
                        {shortcut && <span className="text-xs text-neutral-500">{shortcut}</span>}
                    </button>
                );
            })}
        </div>
    );
};

export default ContextMenu;
