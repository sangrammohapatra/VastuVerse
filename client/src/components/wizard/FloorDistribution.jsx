import { useEffect, useMemo, useRef } from "react";
import { Box, Stack, Typography, Alert, Chip } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

/**
 * Drag-and-drop floor distribution (only rendered when floors > 1).
 *
 *   floors         number of storeys (>= 2)
 *   rooms          [{ id, label, kind, icon? }]   — derived in Step2Rooms
 *   assignments    { unassigned: [id,...], floor1: [...], floor2: [...] }
 *   onChange(next) called with updated assignments
 *
 * Reconciles assignments against the current rooms list whenever rooms
 * change (e.g. user adjusts bedroom count) — stale ids drop, new ids land
 * in the "unassigned" bucket.
 */
export default function FloorDistribution({
  floors,
  rooms,
  assignments,
  onChange,
}) {
  const theme = useTheme();

  const floorKeys = useMemo(
    () => Array.from({ length: floors }, (_, i) => `floor${i + 1}`),
    [floors],
  );

  const roomById = useMemo(() => {
    const m = new Map();
    rooms.forEach((r) => m.set(r.id, r));
    return m;
  }, [rooms]);

  /* ── Reconcile assignments when rooms / floors change ───────────── */
  const lastReconcileKey = useRef("");
  useEffect(() => {
    const ids = new Set(rooms.map((r) => r.id));
    const current = assignments || {};
    const next = { unassigned: [] };
    floorKeys.forEach((k) => {
      next[k] = [];
    });

    // 1) Keep valid ids in their current floor (in order)
    floorKeys.forEach((k) => {
      (current[k] || []).forEach((id) => {
        if (ids.has(id) && !inAny(next, id)) next[k].push(id);
      });
    });
    (current.unassigned || []).forEach((id) => {
      if (ids.has(id) && !inAny(next, id)) next.unassigned.push(id);
    });

    // 2) New rooms (not yet anywhere) → unassigned
    rooms.forEach((r) => {
      if (!inAny(next, r.id)) next.unassigned.push(r.id);
    });

    const key = JSON.stringify(next);
    if (key !== lastReconcileKey.current) {
      lastReconcileKey.current = key;
      // Only call if it actually differs from incoming assignments too,
      // to avoid a useless write loop on first mount.
      if (key !== JSON.stringify(current)) {
        onChange?.(next);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms, floors]);

  function inAny(map, id) {
    for (const k of Object.keys(map)) if (map[k].includes(id)) return true;
    return false;
  }

  /* ── Drag end handler ───────────────────────────────────────────── */
  const onDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    )
      return;

    const next = { unassigned: [], ...assignments };
    floorKeys.forEach((k) => {
      next[k] = next[k] || [];
    });

    const fromList = Array.from(next[source.droppableId] || []);
    const [moved] = fromList.splice(source.index, 1);
    if (!moved) return;

    if (source.droppableId === destination.droppableId) {
      fromList.splice(destination.index, 0, moved);
      next[source.droppableId] = fromList;
    } else {
      const toList = Array.from(next[destination.droppableId] || []);
      toList.splice(destination.index, 0, moved);
      next[source.droppableId] = fromList;
      next[destination.droppableId] = toList;
    }
    onChange?.(next);
  };

  /* ── Staircase coverage warning ─────────────────────────────────── */
  const missingStaircase = floorKeys.filter((k) => {
    const ids = assignments?.[k] || [];
    return !ids.some((id) => id.startsWith("stair-"));
  });

  return (
    <Box>
      {missingStaircase.length > 0 && (
        <Alert
          severity="warning"
          icon={<WarningAmberIcon />}
          sx={{ mb: 2, borderRadius: 1 }}
        >
          Missing staircase on{" "}
          {missingStaircase.map((k) => k.replace("floor", "Floor ")).join(", ")}
          . Every floor in a multi-storey home needs a staircase for NBC
          compliance.
        </Alert>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, 1fr)",
              md: `repeat(${Math.min(floors + 1, 4)}, 1fr)`,
            },
            gap: 2,
          }}
        >
          {/* One column per floor */}
          {floorKeys.map((key, idx) => (
            <FloorColumn
              key={key}
              droppableId={key}
              title={`Floor ${idx + 1}`}
              hint={
                idx === 0
                  ? "Ground floor"
                  : idx === floors - 1
                    ? "Top floor"
                    : ""
              }
              ids={assignments?.[key] || []}
              roomById={roomById}
            />
          ))}
          {/* Unassigned bucket */}
          <FloorColumn
            key="unassigned"
            droppableId="unassigned"
            title="Unassigned"
            hint="Drag rooms onto a floor"
            ids={assignments?.unassigned || []}
            roomById={roomById}
            muted
          />
        </Box>
      </DragDropContext>
    </Box>
  );
}

/* ── Floor column ──────────────────────────────────────────────────── */

function FloorColumn({ droppableId, title, hint, ids, roomById, muted }) {
  const theme = useTheme();

  return (
    <Droppable droppableId={droppableId}>
      {(provided, snapshot) => (
        <Box
          ref={provided.innerRef}
          {...provided.droppableProps}
          sx={{
            minHeight: 180,
            p: 1.5,
            borderRadius: 1,
            background: muted
              ? theme.palette.mode === "dark"
                ? "rgba(255,255,255,0.02)"
                : "rgba(0,0,0,0.02)"
              : theme.vastu.cardBg,
            border: snapshot.isDraggingOver
              ? `2px dashed ${theme.palette.primary.main}`
              : theme.vastu.cardBorder,
            backdropFilter: theme.vastu.cardBlur,
            transition: "border-color .2s, background .2s",
          }}
        >
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="baseline"
            sx={{ mb: 1.2 }}
          >
            <Typography sx={{ fontWeight: 700, fontSize: "0.95rem" }}>
              {title}
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {hint} {ids.length > 0 ? `· ${ids.length}` : ""}
            </Typography>
          </Stack>

          <Stack spacing={0.75}>
            {ids.length === 0 && (
              <Typography
                variant="caption"
                sx={{
                  color: "text.secondary",
                  fontStyle: "italic",
                  mt: 0.5,
                  textAlign: "center",
                }}
              >
                {muted ? "All rooms placed." : "Drop rooms here"}
              </Typography>
            )}
            {ids.map((id, index) => {
              const room = roomById.get(id);
              if (!room) return null;
              return (
                <Draggable key={id} draggableId={id} index={index}>
                  {(p, snap) => (
                    <Chip
                      ref={p.innerRef}
                      {...p.draggableProps}
                      {...p.dragHandleProps}
                      icon={room.icon || undefined}
                      label={room.label}
                      sx={{
                        pl: 1,
                        fontWeight: 600,
                        cursor: "grab",
                        boxShadow: snap.isDragging
                          ? `0 8px 24px ${theme.palette.primary.main}55`
                          : "none",
                        background: snap.isDragging
                          ? theme.palette.primary.main
                          : theme.palette.mode === "dark"
                            ? "rgba(255,255,255,0.06)"
                            : "rgba(0,0,0,0.05)",
                        color: snap.isDragging ? "#fff" : "text.primary",
                        justifyContent: "flex-start",
                        "& .MuiChip-icon": { color: "inherit" },
                      }}
                    />
                  )}
                </Draggable>
              );
            })}
            {provided.placeholder}
          </Stack>
        </Box>
      )}
    </Droppable>
  );
}
