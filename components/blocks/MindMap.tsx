"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, X, Palette, 
  ZoomIn, ZoomOut, RotateCcw, Square, Diamond, Circle,
  Bold, Italic, Underline, Edit3
} from "lucide-react";

export type NodeShape = 'rectangle' | 'diamond' | 'oval';

export interface MindMapNode {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  shape?: NodeShape;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export interface MindMapConnection {
  id: string;
  from: string;
  to: string;
  label?: string;
}

interface MindMapProps {
  nodes: MindMapNode[];
  connections: MindMapConnection[];
  onChange: (nodes: MindMapNode[], connections: MindMapConnection[]) => void;
  title?: string;
  onTitleChange?: (title: string) => void;
}

const nodeColors = [
  { name: "Sage", value: "sage", bg: "hsl(162 22% 42%)", border: "hsl(160 25% 50%)", text: "#ffffff" },
  { name: "Gold", value: "gold", bg: "hsl(40 75% 45%)", border: "hsl(42 80% 55%)", text: "#ffffff" },
  { name: "Rose", value: "rose", bg: "hsl(350 60% 50%)", border: "hsl(350 65% 60%)", text: "#ffffff" },
  { name: "Sky", value: "sky", bg: "hsl(200 70% 45%)", border: "hsl(200 75% 55%)", text: "#ffffff" },
  { name: "Violet", value: "violet", bg: "hsl(270 50% 50%)", border: "hsl(270 55% 60%)", text: "#ffffff" },
  { name: "Coral", value: "coral", bg: "hsl(16 70% 55%)", border: "hsl(16 75% 65%)", text: "#ffffff" },
];

const shapeIcons = [
  { shape: 'rectangle' as NodeShape, icon: Square, label: 'Rectangle' },
  { shape: 'oval' as NodeShape, icon: Circle, label: 'Oval' },
];

const MindMap = ({ nodes, connections, onChange, title = "Mind Map", onTitleChange }: MindMapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [connectingFromHandle, setConnectingFromHandle] = useState<'top' | 'right' | 'bottom' | 'left' | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null);
  const [showShapePicker, setShowShapePicker] = useState<string | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editableTitle, setEditableTitle] = useState(title);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hoveredConnection, setHoveredConnection] = useState<string | null>(null);
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);
  const [labelInputValue, setLabelInputValue] = useState("");
  const [labelPopoverPos, setLabelPopoverPos] = useState({ x: 0, y: 0 });
  const labelInputRef = useRef<HTMLInputElement>(null);

  const minZoom = 0.25;
  const maxZoom = 2;
  const zoomStep = 0.15;

  // Mobile Pinch/Touch tracking refs
  const initialTouchDistanceRef = useRef<number | null>(null);
  const initialTouchZoomRef = useRef<number>(1);

  useEffect(() => {
    setEditableTitle(title);
  }, [title]);

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (onTitleChange && editableTitle.trim()) {
      onTitleChange(editableTitle.trim());
    }
  };

  const submitLabel = () => {
    if (editingConnectionId) {
      updateConnection(editingConnectionId, { label: labelInputValue.trim() });
    }
    setEditingConnectionId(null);
    setLabelInputValue("");
  };

  const closeLabel = () => {
    setEditingConnectionId(null);
    setLabelInputValue("");
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + zoomStep, maxZoom));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - zoomStep, minZoom));
  const handleResetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -zoomStep : zoomStep;
      setZoom((prev) => Math.min(Math.max(prev + delta, minZoom), maxZoom));
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  const getNodeColor = (colorValue: string) => {
    return nodeColors.find(c => c.value === colorValue) || nodeColors[0];
  };

  const addNode = useCallback(() => {
    const containerRect = containerRef.current?.getBoundingClientRect();
    const centerX = containerRect ? containerRect.width / 2 : 200;
    const centerY = containerRect ? containerRect.height / 2 : 150;
    
    const newNode: MindMapNode = {
      id: crypto.randomUUID(),
      text: "New idea",
      x: (centerX - pan.x) / zoom + (Math.random() - 0.5) * 100,
      y: (centerY - pan.y) / zoom + (Math.random() - 0.5) * 100,
      color: nodeColors[Math.floor(Math.random() * nodeColors.length)].value,
      shape: 'rectangle',
    };
    onChange([...nodes, newNode], connections);
  }, [nodes, connections, onChange, pan, zoom]);

  const updateNode = useCallback((id: string, updates: Partial<MindMapNode>) => {
    onChange(nodes.map((node) => (node.id === id ? { ...node, ...updates } : node)), connections);
  }, [nodes, connections, onChange]);

  const deleteNode = useCallback((id: string) => {
    onChange(nodes.filter((node) => node.id !== id), connections.filter((conn) => conn.from !== id && conn.to !== id));
  }, [nodes, connections, onChange]);

  const addConnection = useCallback((from: string, to: string) => {
    if (from === to) return;
    const exists = connections.some((conn) => (conn.from === from && conn.to === to) || (conn.from === to && conn.to === from));
    if (exists) return;
    onChange(nodes, [...connections, { id: crypto.randomUUID(), from, to }]);
  }, [nodes, connections, onChange]);

  const deleteConnection = useCallback((id: string) => {
    onChange(nodes, connections.filter((conn) => conn.id !== id));
  }, [nodes, connections, onChange]);

  const updateConnection = useCallback((id: string, updates: Partial<MindMapConnection>) => {
    onChange(
      nodes,
      connections.map((conn) => (conn.id === id ? { ...conn, ...updates } : conn))
    );
  }, [nodes, connections, onChange]);

  const getNodeDimensions = (node: MindMapNode) => {
    const shape = node.shape || 'rectangle';
    const textLength = node.text.length;
    
    let minWidth = 100;
    let maxWidth = 300;
    
    const charWidth = 8;
    const calculatedWidth = Math.max(minWidth, Math.min(textLength * charWidth + 40, maxWidth));
    
    switch (shape) {
      case 'diamond': 
        return { width: Math.max(calculatedWidth, 100), height: Math.max(calculatedWidth, 100) };
      case 'oval': 
        return { width: calculatedWidth, height: 50 };
      default: 
        const lines = Math.ceil(textLength / 30);
        return { width: calculatedWidth, height: Math.max(50, lines * 24 + 24) };
    }
  };

  const getNodeCenter = (node: MindMapNode) => {
    const dims = getNodeDimensions(node);
    return { x: node.x + dims.width / 2, y: node.y + dims.height / 2 };
  };

  const getHandlePositions = (node: MindMapNode) => {
    const dims = getNodeDimensions(node);
    const cx = node.x + dims.width / 2;
    const cy = node.y + dims.height / 2;
    return {
      top: { x: cx, y: node.y },
      right: { x: node.x + dims.width, y: cy },
      bottom: { x: cx, y: node.y + dims.height },
      left: { x: node.x, y: cy },
    };
  };

  const getBezierCurve = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const curvature = Math.min(distance * 0.4, 120);

    let cp1 = { x: from.x, y: from.y };
    let cp2 = { x: to.x, y: to.y };

    if (Math.abs(dx) > Math.abs(dy)) {
      cp1 = { x: from.x + (dx > 0 ? curvature : -curvature), y: from.y };
      cp2 = { x: to.x + (dx > 0 ? -curvature : curvature), y: to.y };
    } else {
      cp1 = { x: from.x, y: from.y + (dy > 0 ? curvature : -curvature) };
      cp2 = { x: to.x + (dy > 0 ? -curvature : curvature), y: to.y };
    }

    const d = `M ${from.x} ${from.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${to.x} ${to.y}`;
    return { d, cp1, cp2 };
  };

  const getPointOnCubicBezier = (
    t: number,
    p0: { x: number; y: number },
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    p3: { x: number; y: number }
  ) => {
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;

    const x = uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x;
    const y = uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y;
    return { x, y };
  };

  const getTangentOnCubicBezier = (
    t: number,
    p0: { x: number; y: number },
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    p3: { x: number; y: number }
  ) => {
    const u = 1 - t;
    const x =
      3 * u * u * (p1.x - p0.x) +
      6 * u * t * (p2.x - p1.x) +
      3 * t * t * (p3.x - p2.x);
    const y =
      3 * u * u * (p1.y - p0.y) +
      6 * u * t * (p2.y - p1.y) +
      3 * t * t * (p3.y - p2.y);
    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    
    startNodeDrag(nodeId, e.clientX, e.clientY);
  };

  // Node touch start mapping to identical drag logic
  const handleTouchStartNode = (e: React.TouchEvent, nodeId: string) => {
    e.stopPropagation();
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    startNodeDrag(nodeId, touch.clientX, touch.clientY);
  };

  const startNodeDrag = (nodeId: string, clientX: number, clientY: number) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    
    if (connectingFrom) {
      if (connectingFrom !== nodeId) {
        addConnection(connectingFrom, nodeId);
      }
      setConnectingFrom(null);
      setConnectingFromHandle(null);
      return;
    }
    
    draggingNodeRef.current = nodeId;
    setDraggingNode(nodeId);
    setShowColorPicker(null);
    setShowShapePicker(null);
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const off = {
        x: clientX - rect.left - node.x * zoom - pan.x,
        y: clientY - rect.top  - node.y * zoom - pan.y,
      };
      offsetRef.current = off;
      setOffset(off);
    }
  };

  const draggingNodeRef = useRef<string | null>(null);
  const isPanningRef    = useRef(false);
  const offsetRef       = useRef({ x: 0, y: 0 });
  const panStartRef     = useRef({ x: 0, y: 0 });
  const panRef          = useRef(pan);
  const zoomRef         = useRef(zoom);
  useEffect(() => { panRef.current  = pan;  }, [pan]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setMousePos({
        x: (e.clientX - rect.left - panRef.current.x) / zoomRef.current,
        y: (e.clientY - rect.top  - panRef.current.y) / zoomRef.current,
      });
    }
    if (draggingNodeRef.current) {
      if (!rect) return;
      const newX = (e.clientX - rect.left - offsetRef.current.x - panRef.current.x) / zoomRef.current;
      const newY = (e.clientY - rect.top  - offsetRef.current.y - panRef.current.y) / zoomRef.current;
      updateNode(draggingNodeRef.current, { x: newX, y: newY });
    } else if (isPanningRef.current) {
      setPan({ x: e.clientX - panStartRef.current.x, y: e.clientY - panStartRef.current.y });
    }
  }, [updateNode]);

  // Integrated Mobile Touch Move Handler (Handles both Touch Panning & Pinch to Zoom)
  const handleTouchMove = useCallback((e: TouchEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    // 1. Double finger interaction: Pinch to Zoom
    if (e.touches.length === 2) {
      e.preventDefault(); // Stop native scrolling/zoom gestures
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const currentDistance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);

      if (initialTouchDistanceRef.current === null) {
        initialTouchDistanceRef.current = currentDistance;
        initialTouchZoomRef.current = zoomRef.current;
      } else {
        const scaleFactor = currentDistance / initialTouchDistanceRef.current;
        const targetZoom = Math.min(Math.max(initialTouchZoomRef.current * scaleFactor, minZoom), maxZoom);
        setZoom(targetZoom);
      }
      return;
    }

    // 2. Single finger interaction: Node Dragging or Canvas Panning
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setMousePos({
        x: (touch.clientX - rect.left - panRef.current.x) / zoomRef.current,
        y: (touch.clientY - rect.top  - panRef.current.y) / zoomRef.current,
      });

      if (draggingNodeRef.current) {
        const newX = (touch.clientX - rect.left - offsetRef.current.x - panRef.current.x) / zoomRef.current;
        const newY = (touch.clientY - rect.top  - offsetRef.current.y - panRef.current.y) / zoomRef.current;
        updateNode(draggingNodeRef.current, { x: newX, y: newY });
      } else if (isPanningRef.current) {
        setPan({ x: touch.clientX - panStartRef.current.x, y: touch.clientY - panStartRef.current.y });
      }
    }
  }, [updateNode, minZoom, maxZoom]);

  const handleMouseUp = useCallback(() => {
    draggingNodeRef.current = null;
    isPanningRef.current    = false;
    setDraggingNode(null);
    setIsPanning(false);
  }, []);

  const handleTouchEnd = useCallback(() => {
    draggingNodeRef.current = null;
    isPanningRef.current    = false;
    setDraggingNode(null);
    setIsPanning(false);
    // Reset pinch metrics when fingers lift
    initialTouchDistanceRef.current = null;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    // Desktop Listeners
    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseup",   handleMouseUp);
    window.addEventListener("mouseup", handleMouseUp);
    
    // Mobile Touch Listeners (Set passive to false to ensure preventDefault functions properly during pitch zooming)
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("touchend", handleTouchEnd);
    
    return () => {
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseup",   handleMouseUp);
      window.removeEventListener("mouseup", handleMouseUp);
      
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  const handleContainerMouseDown = (e: React.MouseEvent) => {
    if (editingConnectionId) {
      setEditingConnectionId(null);
      setLabelInputValue("");
    }
    e.stopPropagation();

    const target = e.target as HTMLElement;
    const isCanvasArea = target === containerRef.current ||
      target.classList.contains('mindmap-canvas') ||
      target.tagName === 'svg' ||
      !!target.closest('svg');

    if (isCanvasArea && !target.closest('.mindmap-node-wrapper')) {
      setShowColorPicker(null);
      setShowShapePicker(null);
      if (connectingFrom) {
        setConnectingFrom(null);
        setConnectingFromHandle(null);
        return;
      }
      startCanvasPan(e.clientX, e.clientY);
    }
  };

  // Canvas Mobile Touch Start
  const handleContainerTouchStart = (e: React.TouchEvent) => {
    if (editingConnectionId) {
      setEditingConnectionId(null);
      setLabelInputValue("");
    }
    e.stopPropagation();

    const target = e.target as HTMLElement;
    const isCanvasArea = target === containerRef.current ||
      target.classList.contains('mindmap-canvas') ||
      target.tagName === 'svg' ||
      !!target.closest('svg');

    if (isCanvasArea && !target.closest('.mindmap-node-wrapper')) {
      setShowColorPicker(null);
      setShowShapePicker(null);
      if (connectingFrom) {
        setConnectingFrom(null);
        setConnectingFromHandle(null);
        return;
      }
      
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        startCanvasPan(touch.clientX, touch.clientY);
      } else if (e.touches.length === 2) {
        // Prepare pinch configuration context immediately
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        initialTouchDistanceRef.current = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
        initialTouchZoomRef.current = zoomRef.current;
      }
    }
  };

  const startCanvasPan = (clientX: number, clientY: number) => {
    const ps = { x: clientX - panRef.current.x, y: clientY - panRef.current.y };
    panStartRef.current  = ps;
    isPanningRef.current = true;
    setPanStart(ps);
    setIsPanning(true);
  };

  const handleNodeDoubleClick = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setEditingNodeId(nodeId);
  };

  // Double tap handler for text editing on mobile viewports
  const lastTapRef = useRef<{ [key: string]: number }>({});
  const handleNodeTouchStart = (e: React.TouchEvent, nodeId: string) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (lastTapRef.current[nodeId] && (now - lastTapRef.current[nodeId] < DOUBLE_TAP_DELAY)) {
      e.stopPropagation();
      setEditingNodeId(nodeId);
    }
    lastTapRef.current[nodeId] = now;
  };

  const startConnection = (clientX: number, clientY: number, nodeId: string, handle: 'top' | 'right' | 'bottom' | 'left') => {
    setConnectingFrom(nodeId);
    setConnectingFromHandle(handle);
  };

  const renderConnections = () => {
    return connections.map((conn) => {
      const fromNode = nodes.find((n) => n.id === conn.from);
      const toNode = nodes.find((n) => n.id === conn.to);
      if (!fromNode || !toNode) return null;

      const fromHandles = getHandlePositions(fromNode);
      const toHandles = getHandlePositions(toNode);
      
      let minDist = Infinity;
      let bestFrom = fromHandles.right;
      let bestTo = toHandles.left;
      
      Object.values(fromHandles).forEach(fh => {
        Object.values(toHandles).forEach(th => {
          const dist = Math.hypot(fh.x - th.x, fh.y - th.y);
          if (dist < minDist) {
            minDist = dist;
            bestFrom = fh;
            bestTo = th;
          }
        });
      });

      const curve = getBezierCurve(bestFrom, bestTo);
      const t = 0.5;
      const labelBase = getPointOnCubicBezier(t, bestFrom, curve.cp1, curve.cp2, bestTo);
      const tangent = getTangentOnCubicBezier(t, bestFrom, curve.cp1, curve.cp2, bestTo);
      const tangentLen = Math.hypot(tangent.x, tangent.y) || 1;
      const nx = -tangent.y / tangentLen;
      const ny = tangent.x / tangentLen;
      const labelPos = { x: labelBase.x + nx * 12, y: labelBase.y + ny * 12 };
      const isHovered = hoveredConnection === conn.id;

      const labelText = (conn.label || "").trim();
      const showLabel = labelText.length > 0 || isHovered;
      const displayLabel = labelText.length > 0 ? labelText : "Add label";
      const approxTextWidth = Math.min(220, Math.max(44, displayLabel.length * 7 + 18));
      const labelId = `mm-conn-label-${conn.id}`;

      return (
        <g 
          key={conn.id} 
          className="mindmap-connection cursor-pointer" 
          onMouseEnter={() => setHoveredConnection(conn.id)}
          onMouseLeave={() => setHoveredConnection(null)}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <path d={curve.d} stroke="transparent" strokeWidth="16" fill="none" />
          <path
            d={curve.d}
            stroke={isHovered ? "hsl(var(--accent))" : "hsl(var(--primary))"}
            strokeWidth="2"
            fill="none"
            className="transition-colors duration-200"
            strokeLinecap="round"
            markerEnd={isHovered ? "url(#mindmap-arrow-hover)" : "url(#mindmap-arrow)"}
          />

          <circle cx={bestFrom.x} cy={bestFrom.y} r="3" fill="hsl(var(--primary))" />

          {showLabel && (
            <g
              aria-label={displayLabel}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                const rect = containerRef.current?.getBoundingClientRect();
                if (!rect) return;
                const screenX = labelPos.x * zoom + pan.x + rect.left;
                const screenY = labelPos.y * zoom + pan.y + rect.top;
                setLabelPopoverPos({ x: screenX, y: screenY });
                setLabelInputValue(labelText);
                setEditingConnectionId(conn.id);
                setTimeout(() => labelInputRef.current?.focus(), 30);
              }}
            >
              <rect
                x={labelPos.x - approxTextWidth / 2}
                y={labelPos.y - 10}
                width={approxTextWidth}
                height={20}
                rx={10}
                fill="hsl(var(--card))"
                stroke="hsl(var(--border))"
                strokeWidth={1}
                opacity={labelText.length > 0 ? 0.98 : 0.85}
              />
              <text
                id={labelId}
                x={labelPos.x}
                y={labelPos.y + 4}
                textAnchor="middle"
                className="select-none"
                style={{
                  fill: "hsl(var(--foreground))",
                  fontSize: 11,
                  fontWeight: 500,
                }}
              >
                {displayLabel}
              </text>
            </g>
          )}

          {isHovered && (
            <g
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                deleteConnection(conn.id);
              }}
            >
              <circle cx={labelPos.x} cy={labelPos.y} r="10" fill="hsl(var(--destructive))" />
              <text
                x={labelPos.x}
                y={labelPos.y + 4}
                textAnchor="middle"
                className="text-[11px] font-bold pointer-events-none select-none"
                style={{ fill: "hsl(var(--destructive-foreground))" }}
              >
                ×
              </text>
            </g>
          )}
        </g>
      );
    });
  };

  const renderConnectingLine = () => {
    if (!connectingFrom) return null;
    const fromNode = nodes.find(n => n.id === connectingFrom);
    if (!fromNode) return null;
    
    const handles = getHandlePositions(fromNode);
    const from = connectingFromHandle ? handles[connectingFromHandle] : getNodeCenter(fromNode);
    const curve = getBezierCurve(from, mousePos);

    return (
      <path
        d={curve.d}
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        fill="none"
        strokeDasharray="6,4"
        opacity="0.7"
        strokeLinecap="round"
        markerEnd="url(#mindmap-arrow)"
      />
    );
  };

  const renderNode = (node: MindMapNode) => {
    const colorConfig = getNodeColor(node.color);
    const shape = node.shape || 'rectangle';
    const dims = getNodeDimensions(node);
    const handles = getHandlePositions(node);
    const isHovered = hoveredNode === node.id;
    const isEditing = editingNodeId === node.id;

    const getShapeStyle = () => {
      switch (shape) {
        case 'oval':
          return { borderRadius: '9999px' };
        default:
          return { borderRadius: '12px' };
      }
    };

    return (
      <div
        key={node.id}
        className={`mindmap-node-wrapper absolute select-none ${draggingNode === node.id ? 'z-20' : 'z-10'}`}
        style={{ 
          left: node.x - 10, 
          top: node.y - 10, 
          width: dims.width + 20, 
          height: dims.height + 60,
        }}
        onMouseEnter={() => setHoveredNode(node.id)}
        onMouseLeave={(e) => {
          const relatedTarget = e.relatedTarget as HTMLElement;
          if (relatedTarget && e.currentTarget.contains(relatedTarget)) {
            return;
          }
          if (showColorPicker === node.id || showShapePicker === node.id) {
            return;
          }
          setHoveredNode(null);
        }}
      >
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={{ 
            position: 'absolute',
            left: 10, 
            top: 10, 
            width: dims.width, 
            height: dims.height,
          }}
        >
        {(isHovered || connectingFrom) && (['top', 'right', 'bottom', 'left'] as const).map((pos) => {
          const handlePos = handles[pos];
          const relX = handlePos.x - node.x;
          const relY = handlePos.y - node.y;
          return (
            <motion.button
              key={pos}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); startConnection(e.clientX, e.clientY, node.id, pos); }}
              onTouchStart={(e) => { e.stopPropagation(); if (e.touches.length === 1) { const t = e.touches[0]; startConnection(t.clientX, t.clientY, node.id, pos); } }}
              onClick={(e) => {
                e.stopPropagation();
                if (connectingFrom && connectingFrom !== node.id) {
                  addConnection(connectingFrom, node.id);
                  setConnectingFrom(null);
                  setConnectingFromHandle(null);
                }
              }}
              className={`absolute w-3 h-3 rounded-full transition-all z-30 ${
                connectingFrom === node.id && connectingFromHandle === pos
                  ? 'bg-primary scale-125 ring-2 ring-primary/30'
                  : connectingFrom && connectingFrom !== node.id
                  ? 'bg-accent hover:bg-accent/80 scale-110'
                  : 'bg-muted-foreground/60 hover:bg-primary'
              }`}
              style={{
                left: relX - 6,
                top: relY - 6,
                boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
              }}
              whileHover={{ scale: 1.4 }}
              title="Drag to connect"
            />
          );
        })}

        <div
          onMouseDown={(e) => handleMouseDown(e, node.id)}
          onTouchStart={(e) => { handleTouchStartNode(e, node.id); handleTouchStartNode(e, node.id); }}
          onDoubleClick={(e) => handleNodeDoubleClick(e, node.id)}
          className={`group relative w-full h-full cursor-move transition-shadow duration-200 ${
            connectingFrom === node.id ? 'ring-2 ring-primary' : ''
          }`}
          style={{
            ...getShapeStyle(),
            background: colorConfig.bg,
            border: `2px solid ${colorConfig.border}`,
            boxShadow: isHovered 
              ? `0 8px 24px -4px ${colorConfig.bg}40`
              : `0 2px 8px -2px ${colorConfig.bg}30`,
          }}
        >
          {isHovered && !isEditing && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => { e.stopPropagation(); deleteNode(node.id); }}
              onTouchStart={(e) => e.stopPropagation()}
              className="absolute -top-2 -right-2 z-30 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center shadow-md hover:bg-destructive/90 transition-colors"
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
            >
              <X className="w-3 h-3" />
            </motion.button>
          )}

          <div className={`h-full flex items-center justify-center p-3 ${shape === 'diamond' ? 'p-4' : ''}`}>
            {isEditing ? (
              <textarea
                value={node.text}
                onChange={(e) => updateNode(node.id, { text: e.target.value })}
                onBlur={() => setEditingNodeId(null)}
                onKeyDown={(e) => { 
                  if (e.key === "Escape") setEditingNodeId(null); 
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    setEditingNodeId(null);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                autoFocus
                className={`w-full bg-transparent text-sm outline-none text-center resize-none ${
                  node.bold ? 'font-bold' : 'font-medium'
                } ${node.italic ? 'italic' : ''}`}
                style={{ 
                  textDecoration: node.underline ? 'underline' : 'none',
                  color: colorConfig.text,
                }}
                rows={Math.max(2, Math.ceil(node.text.length / 25))}
              />
            ) : (
              <span
                className={`text-sm text-center leading-relaxed wrap-break-word ${
                  node.bold ? 'font-bold' : 'font-medium'
                } ${node.italic ? 'italic' : ''}`}
                style={{ 
                  textDecoration: node.underline ? 'underline' : 'none',
                  color: colorConfig.text,
                }}
              >
                {node.text || "Double-click to edit"}
              </span>
            )}
          </div>

          {isHovered && !isEditing && (
            <motion.div 
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute -bottom-9 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-card border border-border rounded-lg px-1.5 py-1 shadow-lg z-40"
              onTouchStart={(e) => e.stopPropagation()}
            >
              <button 
                onClick={(e) => { e.stopPropagation(); updateNode(node.id, { bold: !node.bold }); }}
                className={`p-1 rounded transition-colors ${node.bold ? 'bg-muted' : 'hover:bg-muted'}`}
              >
                <Bold className="w-3 h-3 text-muted-foreground" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); updateNode(node.id, { italic: !node.italic }); }}
                className={`p-1 rounded transition-colors ${node.italic ? 'bg-muted' : 'hover:bg-muted'}`}
              >
                <Italic className="w-3 h-3 text-muted-foreground" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); updateNode(node.id, { underline: !node.underline }); }}
                className={`p-1 rounded transition-colors ${node.underline ? 'bg-muted' : 'hover:bg-muted'}`}
              >
                <Underline className="w-3 h-3 text-muted-foreground" />
              </button>
              <div className="w-px h-3 bg-border mx-0.5" />
              <button 
                onClick={(e) => { e.stopPropagation(); setShowShapePicker(showShapePicker === node.id ? null : node.id); setShowColorPicker(null); }}
                className="p-1 hover:bg-muted rounded transition-colors"
              >
                {shape === 'diamond' ? <Diamond className="w-3 h-3 text-muted-foreground" /> :
                 shape === 'oval' ? <Circle className="w-3 h-3 text-muted-foreground" /> :
                 <Square className="w-3 h-3 text-muted-foreground" />}
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowColorPicker(showColorPicker === node.id ? null : node.id); setShowShapePicker(null); }}
                className="p-1 hover:bg-muted rounded transition-colors"
              >
                <Palette className="w-3 h-3 text-muted-foreground" />
              </button>
            </motion.div>
          )}

          {showShapePicker === node.id && (
            <motion.div 
              initial={{ opacity: 0, y: -5 }} 
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-full left-1/2 -translate-x-1/2 mt-11 p-1.5 bg-card border border-border rounded-lg shadow-lg z-50 flex gap-1"
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              {shapeIcons.map(({ shape: s, icon: Icon }) => (
                <button 
                  key={s} 
                  onClick={() => { updateNode(node.id, { shape: s }); setShowShapePicker(null); }}
                  className={`p-1.5 rounded-md hover:bg-muted transition-colors ${shape === s ? 'bg-muted ring-1 ring-primary' : ''}`}
                >
                  <Icon className="w-4 h-4 text-foreground" />
                </button>
              ))}
            </motion.div>
          )}

          {showColorPicker === node.id && (
            <motion.div 
              initial={{ opacity: 0, y: -5 }} 
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-full left-1/2 -translate-x-1/2 mt-11 p-2 bg-card border border-border rounded-lg shadow-lg z-50 flex gap-1.5 flex-wrap max-w-35"
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              {nodeColors.map((color) => (
                <button 
                  key={color.value} 
                  onClick={() => { updateNode(node.id, { color: color.value }); setShowColorPicker(null); }}
                  className={`w-6 h-6 rounded-full hover:scale-110 transition-transform ${
                    node.color === color.value ? 'ring-2 ring-foreground ring-offset-2 ring-offset-card' : ''
                  }`}
                  style={{ background: color.bg }} 
                />
              ))}
            </motion.div>
          )}
        </div>
        </motion.div>
      </div>
    );
  };

  return (
    <div className="relative h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-3 px-2 shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isEditingTitle ? (
            <input 
              type="text" 
              value={editableTitle} 
              onChange={(e) => setEditableTitle(e.target.value)}
              onBlur={handleTitleSubmit} 
              onKeyDown={(e) => { 
                if (e.key === "Enter") handleTitleSubmit(); 
                if (e.key === "Escape") { setEditableTitle(title); setIsEditingTitle(false); } 
              }}
              autoFocus 
              className="text-lg font-semibold bg-transparent border-b-2 border-primary outline-none text-foreground px-1 py-0.5 min-w-37.5 max-w-75" 
            />
          ) : (
            <motion.button 
              onClick={() => setIsEditingTitle(true)} 
              className="group flex items-center gap-2 text-lg font-semibold text-foreground hover:text-primary transition-colors truncate" 
              whileHover={{ scale: 1.02 }}
            >
              <span className="truncate">{title}</span>
              <Edit3 className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </motion.button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 mb-3 px-2 flex-wrap shrink-0">
        <div className="flex items-center gap-2">
          <motion.button 
            onClick={addNode} 
            whileHover={{ scale: 1.05 }} 
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Node
          </motion.button>
          {connectingFrom ? (
            <motion.button 
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ opacity: 1, scale: 1 }} 
              onClick={() => { setConnectingFrom(null); setConnectingFromHandle(null); }}
              className="flex items-center gap-2 px-3 py-1.5 bg-destructive text-destructive-foreground text-sm rounded-lg"
            >
              <X className="w-4 h-4" /> Cancel
            </motion.button>
          ) : (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              Drag canvas to pan • Hover nodes for tools
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <motion.button 
            onClick={handleZoomOut} 
            whileHover={{ scale: 1.1 }} 
            whileTap={{ scale: 0.9 }} 
            disabled={zoom <= minZoom}
            className="p-1.5 hover:bg-background rounded-md transition-colors disabled:opacity-40 text-muted-foreground"
          >
            <ZoomOut className="w-4 h-4" />
          </motion.button>
          <span className="text-xs font-medium w-12 text-center text-foreground">{Math.round(zoom * 100)}%</span>
          <motion.button 
            onClick={handleZoomIn} 
            whileHover={{ scale: 1.1 }} 
            whileTap={{ scale: 0.9 }} 
            disabled={zoom >= maxZoom}
            className="p-1.5 hover:bg-background rounded-md transition-colors disabled:opacity-40 text-muted-foreground"
          >
            <ZoomIn className="w-4 h-4" />
          </motion.button>
          <div className="w-px h-4 bg-border mx-1" />
          <motion.button 
            onClick={handleResetView} 
            whileHover={{ scale: 1.1 }} 
            whileTap={{ scale: 0.9 }}
            className="p-1.5 hover:bg-background rounded-md transition-colors text-muted-foreground"
          >
            <RotateCcw className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      {/* Canvas Layer Container */}
      <div 
        ref={containerRef} 
        onMouseDown={handleContainerMouseDown}
        onTouchStart={handleContainerTouchStart}
        data-no-drag-select
        className={`mindmap-canvas relative flex-1 rounded-xl border border-border overflow-hidden ${
          isPanning ? 'cursor-grabbing' : draggingNode ? 'cursor-move' : 'cursor-grab'
        } ${connectingFrom ? 'cursor-crosshair' : ''}`}
        style={{ 
          background: "hsl(var(--card))",
          minHeight: "500px",
          touchAction: 'none',
        }}
      >
        <div 
          className="absolute inset-0 pointer-events-none" 
          style={{
            backgroundImage: `radial-gradient(circle, hsl(var(--muted-foreground) / 0.2) 1px, transparent 1px)`,
            backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
            backgroundPosition: `${pan.x % (24 * zoom)}px ${pan.y % (24 * zoom)}px`,
          }} 
        />
        
        <div className="absolute bottom-2 left-2 text-[10px] text-muted-foreground/50 font-mono pointer-events-none select-none">
          {Math.round(-pan.x / zoom)}, {Math.round(-pan.y / zoom)}
        </div>

        <div 
          className="absolute origin-top-left"
          style={{ 
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, 
            willChange: 'transform',
          }}
        >
          <svg 
            className="absolute"
            width="20000"
            height="20000"
            style={{ 
              overflow: 'visible',
              left: 0,
              top: 0,
            }}
          >
            <defs>
              <marker
                id="mindmap-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--primary))" />
              </marker>
              <marker
                id="mindmap-arrow-hover"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(var(--accent))" />
              </marker>
            </defs>

            <g>
              {renderConnections()}
              {renderConnectingLine()}
            </g>
          </svg>

          {nodes.length === 0 && (
            <div 
              className="absolute inset-0 flex items-center justify-center" 
              style={{ transform: `scale(${1/zoom})` }}
            >
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center border border-primary/30">
                  <Plus className="w-8 h-8 text-primary" />
                </div>
                <p className="text-muted-foreground mb-2">Start your mind map</p>
                <button 
                  onClick={addNode} 
                  className="text-primary hover:text-primary/80 text-sm hover:underline"
                >
                  Add your first node
                </button>
              </div>
            </div>
          )}

          {nodes.map(renderNode)}
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mt-2 px-2 text-xs text-muted-foreground shrink-0">
        <span>{nodes.length} nodes</span>
        <span>{connections.length} connections</span>
        <span className="text-muted-foreground/60">•</span>
        <span className="text-muted-foreground/60">Drag canvas to pan • Pinch or Ctrl+scroll to zoom</span>
      </div>

      {/* Label Edit Popover */}
      <AnimatePresence>
        {editingConnectionId && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            data-no-drag-select
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className="fixed z-9999 w-68 rounded-xl border border-border bg-card shadow-2xl p-3"
            style={{
              left: Math.min(labelPopoverPos.x - 136, window.innerWidth - 288),
              top:  labelPopoverPos.y + 14,
            }}
          >
            <p className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wide">
              Connection label
            </p>

            <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 border border-border focus-within:border-primary transition-colors">
              <svg className="w-3.5 h-3.5 text-muted-foreground shrink-0" fill="none" viewBox="0 0 16 16">
                <path d="M2 8h12M8 2l4 6-4 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <input
                ref={labelInputRef}
                type="text"
                value={labelInputValue}
                onChange={(e) => setLabelInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter")  { e.preventDefault(); submitLabel(); }
                  if (e.key === "Escape") { e.preventDefault(); closeLabel(); }
                  e.stopPropagation();
                }}
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
                placeholder="Label text…"
              />
              {labelInputValue && (
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setLabelInputValue("")}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex gap-2 mt-2.5">
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={closeLabel}
                className="flex-1 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={submitLabel}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16">
                  <polyline points="2,8 6,12 14,4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Apply
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MindMap;