/* ────────────────────────────────────────────────────────────
 * annotate.js — Annotation canvas with fabric.js
 * ──────────────────────────────────────────────────────────── */

let fabricCanvas = null;
let currentTool = 'freehand';
let currentColor = '#ef4444'; // Default red
let currentStrokeWidth = 4;
let isDrawing = false;
let drawingObject = null;

// History for undo/redo
let canvasHistory = [];
let historyStep = 0;

/**
 * Open annotation canvas with screenshot as background
 */
function openAnnotationCanvas(screenshotDataUrl) {
    const backdrop = document.getElementById('annotation-backdrop');
    if (!backdrop) return;

    backdrop.classList.remove('hidden');

    // Initialize fabric canvas
    const canvasEl = document.getElementById('annotation-canvas');
    if (!canvasEl) return;

    // Create new fabric canvas
    fabricCanvas = new fabric.Canvas('annotation-canvas', {
        isDrawingMode: false,
        selection: true
    });

    // Load screenshot as background
    fabric.Image.fromURL(screenshotDataUrl, (img) => {
        // Calculate canvas dimensions to fit viewport
        const maxWidth = window.innerWidth - 100;
        const maxHeight = window.innerHeight - 200;

        let scale = 1;
        if (img.width > maxWidth || img.height > maxHeight) {
            scale = Math.min(maxWidth / img.width, maxHeight / img.height);
        }

        const canvasWidth = img.width * scale;
        const canvasHeight = img.height * scale;

        fabricCanvas.setWidth(canvasWidth);
        fabricCanvas.setHeight(canvasHeight);

        fabricCanvas.setBackgroundImage(img, fabricCanvas.renderAll.bind(fabricCanvas), {
            scaleX: scale,
            scaleY: scale
        });

        fabricCanvas.renderAll();
    });

    // Set default tool
    setAnnotationTool('freehand');

    // Initialize history
    canvasHistory = [];
    historyStep = 0;
    saveCanvasState();
}

/**
 * Close annotation canvas
 */
function closeAnnotation() {
    const backdrop = document.getElementById('annotation-backdrop');
    if (backdrop) {
        backdrop.classList.add('hidden');
    }

    if (fabricCanvas) {
        fabricCanvas.dispose();
        fabricCanvas = null;
    }

    canvasHistory = [];
    historyStep = 0;
}

/**
 * Finalize annotation and attach to chat
 */
function finalizeAnnotation() {
    if (!fabricCanvas) return;

    // Export canvas with background as PNG
    const dataUrl = fabricCanvas.toDataURL({
        format: 'png',
        quality: 0.9
    });

    // Attach to chat
    attachScreenshotToChat(dataUrl);

    // Close annotation canvas
    closeAnnotation();
}

/**
 * Set active annotation tool
 */
function setAnnotationTool(tool) {
    if (!fabricCanvas) return;

    currentTool = tool;

    // Remove active class from all tool buttons
    document.querySelectorAll('.annotation-tool').forEach(btn => {
        btn.classList.remove('bg-primary', 'text-white');
        btn.classList.add('hover:bg-surface-hover', 'text-slate-300');
    });

    // Add active class to current tool
    const activeBtn = document.getElementById(`tool-${tool}`);
    if (activeBtn) {
        activeBtn.classList.add('bg-primary', 'text-white');
        activeBtn.classList.remove('hover:bg-surface-hover', 'text-slate-300');
    }

    // Remove previous event listeners
    fabricCanvas.off('mouse:down');
    fabricCanvas.off('mouse:move');
    fabricCanvas.off('mouse:up');

    if (tool === 'freehand') {
        fabricCanvas.isDrawingMode = true;
        fabricCanvas.freeDrawingBrush = new fabric.PencilBrush(fabricCanvas);
        fabricCanvas.freeDrawingBrush.width = currentStrokeWidth;
        fabricCanvas.freeDrawingBrush.color = currentColor;

        // Save state after path is created
        fabricCanvas.on('path:created', () => {
            saveCanvasState();
        });

    } else {
        fabricCanvas.isDrawingMode = false;

        if (tool === 'arrow') {
            setupArrowTool();
        } else if (tool === 'rectangle') {
            setupRectangleTool();
        } else if (tool === 'text') {
            setupTextTool();
        }
    }
}

/**
 * Setup arrow drawing tool (USER PRIORITY - must work perfectly!)
 */
function setupArrowTool() {
    let startPoint = null;
    let arrow = null;

    fabricCanvas.on('mouse:down', (options) => {
        isDrawing = true;
        const pointer = fabricCanvas.getPointer(options.e);
        startPoint = { x: pointer.x, y: pointer.y };

        // Create arrow line
        const points = [startPoint.x, startPoint.y, startPoint.x, startPoint.y];
        arrow = new fabric.Line(points, {
            stroke: currentColor,
            strokeWidth: currentStrokeWidth,
            selectable: false,
            evented: false
        });

        fabricCanvas.add(arrow);
    });

    fabricCanvas.on('mouse:move', (options) => {
        if (!isDrawing || !arrow) return;

        const pointer = fabricCanvas.getPointer(options.e);
        arrow.set({ x2: pointer.x, y2: pointer.y });
        fabricCanvas.renderAll();
    });

    fabricCanvas.on('mouse:up', (options) => {
        if (!isDrawing || !arrow) return;

        isDrawing = false;
        const pointer = fabricCanvas.getPointer(options.e);

        // Calculate arrow head
        const x1 = arrow.x1;
        const y1 = arrow.y1;
        const x2 = pointer.x;
        const y2 = pointer.y;

        // Calculate angle
        const angle = Math.atan2(y2 - y1, x2 - x1);

        // Arrow head size
        const headlen = 15 + (currentStrokeWidth * 2);

        // Calculate arrow head points
        const arrowHeadAngle = Math.PI / 6; // 30 degrees

        const x3 = x2 - headlen * Math.cos(angle - arrowHeadAngle);
        const y3 = y2 - headlen * Math.sin(angle - arrowHeadAngle);

        const x4 = x2 - headlen * Math.cos(angle + arrowHeadAngle);
        const y4 = y2 - headlen * Math.sin(angle + arrowHeadAngle);

        // Create arrow head as triangle
        const arrowHead = new fabric.Polygon([
            { x: x2, y: y2 },
            { x: x3, y: y3 },
            { x: x4, y: y4 }
        ], {
            fill: currentColor,
            selectable: false,
            evented: false
        });

        // Group arrow line and head
        const group = new fabric.Group([arrow, arrowHead], {
            selectable: true,
            hasControls: false,
            hasBorders: true,
            lockScalingX: true,
            lockScalingY: true
        });

        fabricCanvas.remove(arrow);
        fabricCanvas.add(group);
        fabricCanvas.renderAll();

        saveCanvasState();
        arrow = null;
        startPoint = null;
    });
}

/**
 * Setup rectangle drawing tool
 */
function setupRectangleTool() {
    let startPoint = null;
    let rect = null;

    fabricCanvas.on('mouse:down', (options) => {
        isDrawing = true;
        const pointer = fabricCanvas.getPointer(options.e);
        startPoint = { x: pointer.x, y: pointer.y };

        rect = new fabric.Rect({
            left: startPoint.x,
            top: startPoint.y,
            width: 0,
            height: 0,
            fill: 'transparent',
            stroke: currentColor,
            strokeWidth: currentStrokeWidth,
            selectable: false,
            evented: false
        });

        fabricCanvas.add(rect);
    });

    fabricCanvas.on('mouse:move', (options) => {
        if (!isDrawing || !rect) return;

        const pointer = fabricCanvas.getPointer(options.e);

        const width = pointer.x - startPoint.x;
        const height = pointer.y - startPoint.y;

        if (width < 0) {
            rect.set({ left: pointer.x });
        }
        if (height < 0) {
            rect.set({ top: pointer.y });
        }

        rect.set({
            width: Math.abs(width),
            height: Math.abs(height)
        });

        fabricCanvas.renderAll();
    });

    fabricCanvas.on('mouse:up', () => {
        if (!isDrawing || !rect) return;

        isDrawing = false;
        rect.set({ selectable: true, evented: true });
        fabricCanvas.setActiveObject(rect);
        fabricCanvas.renderAll();

        saveCanvasState();
        rect = null;
        startPoint = null;
    });
}

/**
 * Setup text tool
 */
function setupTextTool() {
    fabricCanvas.on('mouse:down', (options) => {
        const pointer = fabricCanvas.getPointer(options.e);

        const text = new fabric.IText('Click to edit', {
            left: pointer.x,
            top: pointer.y,
            fontSize: 20 + (currentStrokeWidth * 2),
            fill: currentColor,
            fontFamily: 'Inter, sans-serif',
            fontWeight: 'bold'
        });

        fabricCanvas.add(text);
        fabricCanvas.setActiveObject(text);
        text.enterEditing();
        text.selectAll();
        fabricCanvas.renderAll();

        saveCanvasState();
    });
}

/**
 * Set annotation color
 */
function setAnnotationColor(color) {
    currentColor = color;

    // Update active color button border
    document.querySelectorAll('button[onclick^="setAnnotationColor"]').forEach(btn => {
        if (btn.onclick.toString().includes(color)) {
            btn.style.borderColor = 'white';
            btn.style.borderWidth = '2px';
        } else {
            btn.style.borderColor = 'transparent';
        }
    });

    // Update current tool with new color
    if (fabricCanvas) {
        if (fabricCanvas.isDrawingMode) {
            fabricCanvas.freeDrawingBrush.color = color;
        }

        // Update selected object color
        const activeObject = fabricCanvas.getActiveObject();
        if (activeObject) {
            if (activeObject.type === 'i-text') {
                activeObject.set('fill', color);
            } else {
                activeObject.set('stroke', color);
            }
            fabricCanvas.renderAll();
        }
    }
}

/**
 * Set stroke width
 */
function setStrokeWidth(width) {
    currentStrokeWidth = width;

    if (fabricCanvas && fabricCanvas.isDrawingMode) {
        fabricCanvas.freeDrawingBrush.width = width;
    }
}

/**
 * Save canvas state for undo/redo
 */
function saveCanvasState() {
    if (!fabricCanvas) return;

    const state = JSON.stringify(fabricCanvas.toJSON());

    // Remove future states if we're not at the end
    canvasHistory = canvasHistory.slice(0, historyStep + 1);

    // Add new state
    canvasHistory.push(state);
    historyStep = canvasHistory.length - 1;

    // Limit history to 20 states
    if (canvasHistory.length > 20) {
        canvasHistory.shift();
        historyStep--;
    }
}

/**
 * Undo last action
 */
function annotationUndo() {
    if (!fabricCanvas || historyStep === 0) return;

    historyStep--;
    const state = canvasHistory[historyStep];

    fabricCanvas.loadFromJSON(state, () => {
        fabricCanvas.renderAll();
    });
}

/**
 * Redo last undone action
 */
function annotationRedo() {
    if (!fabricCanvas || historyStep >= canvasHistory.length - 1) return;

    historyStep++;
    const state = canvasHistory[historyStep];

    fabricCanvas.loadFromJSON(state, () => {
        fabricCanvas.renderAll();
    });
}

/**
 * Clear all annotations (keep background)
 */
function annotationClear() {
    if (!fabricCanvas) return;

    if (confirm('Clear all annotations? This cannot be undone.')) {
        fabricCanvas.getObjects().forEach((obj) => {
            fabricCanvas.remove(obj);
        });

        fabricCanvas.renderAll();
        saveCanvasState();
    }
}
