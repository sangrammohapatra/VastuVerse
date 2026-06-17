import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Card, Stack, Typography, Divider, RadioGroup, FormControlLabel, Radio,
  CardActionArea,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';

import KitchenIcon from '@mui/icons-material/Kitchen';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import LocalDiningIcon from '@mui/icons-material/LocalDining';
import BedIcon from '@mui/icons-material/Bed';
import BathtubIcon from '@mui/icons-material/Bathtub';
import ShowerIcon from '@mui/icons-material/Shower';
import StairsIcon from '@mui/icons-material/Stairs';
import BalconyIcon from '@mui/icons-material/Balcony';
import WeekendIcon from '@mui/icons-material/Weekend';
import LocalDiningOutlinedIcon from '@mui/icons-material/LocalDiningOutlined';
import SelfImprovementIcon from '@mui/icons-material/SelfImprovement';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import DeckIcon from '@mui/icons-material/Deck';
import Inventory2Icon from '@mui/icons-material/Inventory2';

import { api } from '../../utils/axiosInstance';
import RoomCountStepper from '../../components/wizard/RoomCountStepper';
import AdditionalSpacesGrid from '../../components/wizard/AdditionalSpacesGrid';
import FloorDistribution from '../../components/wizard/FloorDistribution';
import AISuggestionsPanel from '../../components/wizard/AISuggestionsPanel';

const KITCHEN_OPTIONS = [
  {
    id: 'modular',
    label: 'Modular',
    desc: 'Built-in cabinets, optimized for space',
    Icon: KitchenIcon,
  },
  {
    id: 'open',
    label: 'Open',
    desc: 'Opens onto dining or living area',
    Icon: RestaurantMenuIcon,
  },
  {
    id: 'traditional',
    label: 'Traditional',
    desc: 'Closed kitchen with separate utility',
    Icon: LocalDiningIcon,
  },
];

/* ── Room derivation: convert roomConfig → ordered list of chip-shaped rooms ── */
function buildRoomList(rc) {
  const list = [];
  const push = (id, label, IconCmp) =>
    list.push({ id, label, icon: IconCmp ? <IconCmp sx={{ fontSize: 16 }} /> : null });

  for (let i = 1; i <= (rc.bedrooms || 0); i++) push(`bed-${i}`, `Bedroom ${i}`, BedIcon);
  for (let i = 1; i <= (rc.attachedBathrooms || 0); i++) push(`atb-${i}`, `Attached bath ${i}`, BathtubIcon);
  for (let i = 1; i <= (rc.commonBathrooms || 0); i++) push(`cb-${i}`, `Bathroom ${i}`, ShowerIcon);
  push('kitchen', 'Kitchen', KitchenIcon);

  const sp = rc.additionalSpaces || [];
  if (sp.includes('living'))  push('living', 'Living', WeekendIcon);
  if (sp.includes('dining'))  push('dining', 'Dining', LocalDiningOutlinedIcon);
  if (sp.includes('pooja'))   push('pooja', 'Pooja', SelfImprovementIcon);
  if (sp.includes('study'))   push('study', 'Study', MenuBookIcon);
  if (sp.includes('garage'))  push('garage', 'Garage', DirectionsCarIcon);
  if (sp.includes('servant')) push('servant', 'Servant', BedIcon);
  if (sp.includes('terrace')) push('terrace', 'Terrace', DeckIcon);
  if (sp.includes('storage')) push('storage', 'Storage', Inventory2Icon);

  if (sp.includes('balcony')) {
    for (let i = 1; i <= (rc.balconies || 0); i++) push(`balcony-${i}`, `Balcony ${i}`, BalconyIcon);
  }
  if (sp.includes('staircase')) {
    for (let i = 1; i <= (rc.staircases || 0); i++) push(`stair-${i}`, `Staircase ${i}`, StairsIcon);
  }

  return list;
}

/* ─────────────────────────────────────────────────────────────────── */

export default function Step2Rooms({ value, onChange }) {
  const theme = useTheme();
  const rc = value.roomConfig || {};
  const floors = Number(value.landDetails?.floors) || 1;
  const vastuEnabled = !!value.vastuEnabled;

  /* ---- patch helper ------------------------------------------------- */
  const patchRoom = useCallback((patch) => {
    onChange({ roomConfig: { ...rc, ...patch } });
  }, [onChange, rc]);

  /* ---- additional-spaces with multi-storey staircase lock --------- */
  const selectedSpaces = rc.additionalSpaces || [];

  const onSpacesChange = (nextArr) => {
    let next = nextArr;
    // Force staircase on multi-storey
    if (floors > 1 && !next.includes('staircase')) next = [...next, 'staircase'];

    const patch = { additionalSpaces: next };
    // Ensure count is at least one per floor (e.g. 3 floors → min 3 staircases)
    if (next.includes('staircase') && floors > 1 && (rc.staircases || 0) < floors) {
      patch.staircases = floors;
    }
    if (next.includes('balcony') && (rc.balconies ?? 0) === 0) {
      patch.balconies = 1;
    }
    if (!next.includes('balcony')) patch.balconies = 0;
    if (!next.includes('staircase') && floors <= 1) patch.staircases = 0;
    patchRoom(patch);
  };

  // When the number of floors changes (user went back to Step 1), bump the
  // staircase count up to match so FloorDistribution has enough rooms.
  const latestValueRef = useRef(value);
  useEffect(() => { latestValueRef.current = value; });
  useEffect(() => {
    if (floors <= 1) return;
    const currentRc = latestValueRef.current.roomConfig || {};
    if ((currentRc.staircases || 0) < floors) {
      onChange({ roomConfig: { ...currentRc, staircases: floors } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floors]);

  const onCountChange = (key, v) => patchRoom({ [key]: v });

  /* ---- derived room list ------------------------------------------- */
  const rooms = useMemo(() => buildRoomList({
    ...rc,
    additionalSpaces: selectedSpaces,
  }), [rc, selectedSpaces]);

  /* ---- floor assignments handler ----------------------------------- */
  const onFloorAssignmentsChange = (next) => patchRoom({ floorAssignments: next });

  /* ---- AI suggestions: debounced fetch on any change --------------- */
  const [aiStatus, setAiStatus] = useState('idle');
  const [aiData, setAiData] = useState({ suggestions: [], warnings: [], maxBUA: 0, feasibilityRating: 'good' });
  const lastSig = useRef('');

  // Compute a content signature that changes whenever a suggestion-affecting
  // field changes (NOT floorAssignments — those don't affect feasibility math).
  const signature = useMemo(() => {
    return JSON.stringify({
      rc: {
        bedrooms: rc.bedrooms ?? 0,
        attachedBathrooms: rc.attachedBathrooms ?? 0,
        commonBathrooms: rc.commonBathrooms ?? 0,
        kitchenType: rc.kitchenType || '',
        additionalSpaces: [...(selectedSpaces || [])].sort(),
        balconies: rc.balconies ?? 0,
        staircases: rc.staircases ?? 0,
      },
      land: {
        area: value.landDetails?.area ?? 0,
        unit: value.landDetails?.unit || 'sqft',
        floors,
        fsi: value.landDetails?.fsi ?? null,
      },
      vastuEnabled,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    rc.bedrooms, rc.attachedBathrooms, rc.commonBathrooms, rc.kitchenType,
    rc.balconies, rc.staircases,
    selectedSpaces, value.landDetails, floors, vastuEnabled,
  ]);

  useEffect(() => {
    if (signature === lastSig.current) return;
    if (signature === '') return;

    const t = setTimeout(async () => {
      lastSig.current = signature;
      setAiStatus('loading');
      try {
        const payload = {
          roomConfig: {
            bedrooms: rc.bedrooms ?? 0,
            attachedBathrooms: rc.attachedBathrooms ?? 0,
            commonBathrooms: rc.commonBathrooms ?? 0,
            kitchenType: rc.kitchenType,
            additionalSpaces: selectedSpaces,
            balconies: rc.balconies ?? 0,
            staircases: rc.staircases ?? 0,
          },
          landDetails: value.landDetails || {},
          vastuEnabled,
        };
        const { data } = await api.post('/ai/room-suggestions', payload);
        setAiData({
          suggestions: data.suggestions || [],
          warnings: data.warnings || [],
          maxBUA: data.maxBUA || 0,
          feasibilityRating: data.feasibilityRating || 'good',
        });
        setAiStatus('ready');
      } catch (e) {
        setAiStatus('error');
      }
    }, 1500);

    return () => clearTimeout(t);
  }, [signature, rc, selectedSpaces, value.landDetails, vastuEnabled]);

  const retry = () => { lastSig.current = ''; /* effect re-fires */ };

  /* ---- render -------------------------------------------------------- */
  return (
    <Stack spacing={3}>
      {/* Bedrooms + bathrooms (top card) */}
      <Card
        elevation={0}
        sx={{
          p: { xs: 2.5, md: 4 },
          background: theme.vastu.cardBg,
          border: theme.vastu.cardBorder,
          backdropFilter: theme.vastu.cardBlur,
          boxShadow: theme.vastu.cardShadow,
        }}
      >
        <Typography sx={{ fontWeight: 700, mb: 2 }}>How many rooms?</Typography>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
            gap: { xs: 2.5, md: 4 },
          }}
        >
          {/* Bedrooms */}
          <Stack spacing={1}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <BedIcon sx={{ color: 'info.main' }} />
              <Typography sx={{ fontWeight: 600 }}>Bedrooms</Typography>
            </Stack>
            <RoomCountStepper
              value={rc.bedrooms ?? 2}
              onChange={(v) => patchRoom({ bedrooms: v })}
              min={1}
              max={10}
            />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>1–10</Typography>
          </Stack>

          {/* Attached bathrooms */}
          <Stack spacing={1}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <BathtubIcon sx={{ color: 'info.main' }} />
              <Typography sx={{ fontWeight: 600 }}>Attached bathrooms</Typography>
            </Stack>
            <RoomCountStepper
              value={rc.attachedBathrooms ?? 1}
              onChange={(v) => patchRoom({ attachedBathrooms: v })}
              min={0}
              max={10}
            />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>One per bedroom is common</Typography>
          </Stack>

          {/* Common bathrooms */}
          <Stack spacing={1}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <ShowerIcon sx={{ color: 'info.main' }} />
              <Typography sx={{ fontWeight: 600 }}>Common bathrooms</Typography>
            </Stack>
            <RoomCountStepper
              value={rc.commonBathrooms ?? 1}
              onChange={(v) => patchRoom({ commonBathrooms: v })}
              min={0}
              max={5}
            />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Guest / shared use</Typography>
          </Stack>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Kitchen type — radio cards */}
        <Typography sx={{ fontWeight: 700, mb: 1.5 }}>Kitchen type</Typography>
        <RadioGroup
          value={rc.kitchenType || ''}
          onChange={(e) => patchRoom({ kitchenType: e.target.value })}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
              gap: 2,
            }}
          >
            {KITCHEN_OPTIONS.map(({ id, label, desc, Icon }) => {
              const selected = rc.kitchenType === id;
              return (
                <Card
                  key={id}
                  elevation={0}
                  sx={{
                    background: theme.vastu.cardBg,
                    border: selected
                      ? `2px solid ${theme.palette.primary.main}`
                      : theme.vastu.cardBorder,
                    boxShadow: selected ? theme.vastu.glowPrimary : 'none',
                    transition: 'border-color .2s, box-shadow .2s',
                  }}
                >
                  <CardActionArea
                    onClick={() => patchRoom({ kitchenType: id })}
                    sx={{ p: 2 }}
                  >
                    <Stack direction="row" alignItems="flex-start" spacing={1.5}>
                      <FormControlLabel
                        value={id}
                        control={<Radio sx={{ p: 0.5 }} />}
                        label=""
                        sx={{ m: 0 }}
                      />
                      <Icon sx={{ color: selected ? 'primary.main' : 'info.main', fontSize: 26 }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700 }}>{label}</Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          {desc}
                        </Typography>
                      </Box>
                    </Stack>
                  </CardActionArea>
                </Card>
              );
            })}
          </Box>
        </RadioGroup>
      </Card>

      {/* Additional spaces */}
      <Card
        elevation={0}
        sx={{
          p: { xs: 2.5, md: 4 },
          background: theme.vastu.cardBg,
          border: theme.vastu.cardBorder,
          backdropFilter: theme.vastu.cardBlur,
          boxShadow: theme.vastu.cardShadow,
        }}
      >
        <Typography sx={{ fontWeight: 700, mb: 2 }}>Additional spaces</Typography>
        <AdditionalSpacesGrid
          selected={selectedSpaces}
          onSelectionChange={onSpacesChange}
          counts={{ balconies: rc.balconies ?? 0, staircases: rc.staircases ?? 0 }}
          onCountChange={onCountChange}
          floors={floors}
        />
      </Card>

      {/* Floor distribution (multi-storey only) */}
      {floors > 1 && (
        <Card
          elevation={0}
          sx={{
            p: { xs: 2.5, md: 4 },
            background: theme.vastu.cardBg,
            border: theme.vastu.cardBorder,
            backdropFilter: theme.vastu.cardBlur,
            boxShadow: theme.vastu.cardShadow,
          }}
        >
          <Stack direction="row" alignItems="baseline" justifyContent="space-between" sx={{ mb: 2 }}>
            <Typography sx={{ fontWeight: 700 }}>Floor distribution</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Drag rooms into floors
            </Typography>
          </Stack>
          <FloorDistribution
            floors={floors}
            rooms={rooms}
            assignments={rc.floorAssignments || {}}
            onChange={onFloorAssignmentsChange}
          />
        </Card>
      )}

      {/* AI suggestions panel */}
      <AISuggestionsPanel
        status={aiStatus}
        suggestions={aiData.suggestions}
        warnings={aiData.warnings}
        maxBUA={aiData.maxBUA}
        feasibilityRating={aiData.feasibilityRating}
        onRetry={retry}
      />
    </Stack>
  );
}
