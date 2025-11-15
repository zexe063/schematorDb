import React from 'react';
import type { NodeProps } from 'reactflow';
// FIX: Import shared DrawingNodeData type.
import { DrawingNodeData } from '../types';

const DrawingNode: React.FC<NodeProps<DrawingNodeData>> = ({ data }) => {
    // FIX: Default width and height to 0 and always render the div,
    // using visibility to hide it initially. This avoids mounting/unmounting the node
    // during drag, which can cause the "ResizeObserver loop" warning.
    const { width = 0, height = 0 } = data;

    const labelStyle: React.CSSProperties = {
        position: 'absolute',
        bottom: -24,
        right: 0,
        backgroundColor: '#18181b',
        color: '#a1a1aa',
        padding: '2px 6px',
        fontSize: '11px',
        borderRadius: '3px',
        fontFamily: "'JetBrains Mono', monospace",
        border: '1px solid #3f3f46'
    };

    return (
        <div
            style={{
                width: `${width}px`,
                height: `${height}px`,
                backgroundColor: 'rgba(45, 155, 240, 0.15)',
                border: `1px solid #2d9bf0`,
                pointerEvents: 'none',
                visibility: width > 0 && height > 0 ? 'visible' : 'hidden',
            }}
        >
            <div style={labelStyle}>
                {Math.round(width)} x {Math.round(height)}
            </div>
        </div>
    );
};

export default DrawingNode;