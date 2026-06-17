import { useCallback, useEffect, useState } from "react";
import {
  Box,
  Card,
  Stack,
  Typography,
  TextField,
  Slider,
  ToggleButton,
  ToggleButtonGroup,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Switch,
  FormControlLabel,
  Autocomplete,
  Button,
  Alert,
  AlertTitle,
  LinearProgress,
  Chip,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { motion, AnimatePresence } from "framer-motion";

import UploadFileIcon from "@mui/icons-material/UploadFile";
import SelfImprovementIcon from "@mui/icons-material/SelfImprovement";

import { INDIAN_STATES } from "../../constants/indiaStates";
import { PLOT_SHAPES, AREA_UNITS } from "../../constants/wizardSteps";
import PlotShapeCard from "./PlotShapeCard";
import CompassSelector from "./CompassSelector";
import ShapeCanvas from "./ShapeCanvas";
import { api } from "../../utils/axiosInstance";

const CITY_SUGGESTIONS = [
  "Bengaluru",
  "Mumbai",
  "Delhi",
  "Chennai",
  "Hyderabad",
  "Pune",
  "Kolkata",
  "Ahmedabad",
  "Jaipur",
  "Lucknow",
  "Surat",
  "Indore",
  "Kochi",
  "Bhopal",
  "Patna",
  "Vadodara",
  "Nagpur",
  "Coimbatore",
  "Visakhapatnam",
  "Chandigarh",
];

const SHAPE_RECOG_CONFIDENCE_THRESHOLD = 0.7;

/**
 * Step1Land — controlled by PlanWizard.
 *
 *   props.value  : { title, vastuEnabled, cityState, landDetails }
 *   props.onChange(patch) : merges into wizard state
 *
 * UI-only state lives inside this component (shape-recognition workflow,
 * municipal lookup status, etc.).
 */
export default function Step1Land({ value, onChange }) {
  const theme = useTheme();

  const cityState = value.cityState || { city: "", state: "" };
  const land = value.landDetails || {};
  const shape = land.shape || "";
  const vastuOn = !!value.vastuEnabled;

  /* ------ field updaters ----------------------------------------------- */
  const patchLand = (patch) => onChange({ landDetails: { ...land, ...patch } });
  const patchCityState = (patch) =>
    onChange({ cityState: { ...cityState, ...patch } });

  /* ------ shape recognition state ------------------------------------- */
  const [recogStatus, setRecogStatus] = useState("idle"); // idle | uploading | done | low_conf | error
  const [detected, setDetected] = useState(null); // { polygon, confidence }
  const [canvasMode, setCanvasMode] = useState("detected"); // detected | manual

  const onShapeFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setRecogStatus("error");
      setDetected({ error: "File exceeds 10 MB." });
      return;
    }
    setRecogStatus("uploading");
    setDetected(null);
    setCanvasMode("detected");

    try {
      const fd = new FormData();
      fd.append("image", file, file.name);
      const { data } = await api.post("/ai/shape-recognition", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setDetected({
        polygon: data.polygon || [],
        confidence: data.confidence || 0,
      });
      if ((data.confidence || 0) < SHAPE_RECOG_CONFIDENCE_THRESHOLD) {
        setRecogStatus("low_conf");
      } else {
        setRecogStatus("done");
      }
    } catch (err) {
      setRecogStatus("error");
      setDetected({ error: err.response?.data?.error || "Recognition failed" });
    }
  };

  /* ------ municipal rules lookup (debounced on city+state) ------------ */
  const [muniStatus, setMuniStatus] = useState("idle"); // idle | loading | ok | missing | error
  const [muniRules, setMuniRules] = useState(null);

  useEffect(() => {
    const c = (cityState.city || "").trim();
    const s = (cityState.state || "").trim();
    if (!c || !s) {
      setMuniStatus("idle");
      setMuniRules(null);
      return;
    }
    setMuniStatus("loading");
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get("/municipal/rules", {
          params: { city: c, state: s },
        });
        if (!data.rules) {
          setMuniStatus("missing");
          setMuniRules(null);
        } else {
          setMuniStatus("ok");
          setMuniRules(data.rules);
          // auto-prefill fsi/far/setbacks if not yet set on the plan
          patchLand({
            fsi: land.fsi ?? data.rules.fsiLimit,
            far: land.far ?? data.rules.farLimit,
            setbacks: land.setbacks ?? data.rules.setbacks,
          });
        }
      } catch (e) {
        setMuniStatus("error");
        setMuniRules(null);
      }
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityState.city, cityState.state]);

  /* ------ render ------------------------------------------------------- */
  return (
    <Card
      elevation={0}
      sx={{
        p: { xs: 2.5, md: 4 },
        background: theme.vastu.cardBg,
        border: vastuOn
          ? `1px solid ${theme.palette.primary.main}66`
          : theme.vastu.cardBorder,
        backdropFilter: theme.vastu.cardBlur,
        WebkitBackdropFilter: theme.vastu.cardBlur,
        boxShadow: vastuOn
          ? `0 0 60px ${theme.palette.primary.main}3a, ${theme.vastu.cardShadow}`
          : theme.vastu.cardShadow,
        transition: "box-shadow .5s ease, border-color .5s ease",
      }}
    >
      <Stack spacing={4}>
        {/* Title field (optional) */}
        <Box>
          <TextField
            fullWidth
            label="Plan name (optional)"
            value={value.title || ""}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="e.g. 3BHK Bengaluru Villa"
          />
        </Box>

        {/* Land area + unit */}
        <Box>
          <Typography sx={{ fontWeight: 700, mb: 1.2 }}>Land area</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              type="number"
              label="Area"
              value={land.area ?? ""}
              onChange={(e) =>
                patchLand({
                  area: e.target.value === "" ? "" : Number(e.target.value),
                })
              }
              inputProps={{ min: 0 }}
              fullWidth
            />
            <ToggleButtonGroup
              exclusive
              value={land.unit || "sqft"}
              onChange={(_e, v) => v && patchLand({ unit: v })}
              sx={{ alignSelf: { xs: "stretch", sm: "center" } }}
            >
              {AREA_UNITS.map((u) => (
                <ToggleButton key={u.value} value={u.value} sx={{ px: 3 }}>
                  {u.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Stack>
        </Box>

        {/* Plot shape */}
        <Box>
          <Typography sx={{ fontWeight: 700, mb: 1.2 }}>Plot shape</Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
              gap: 2,
            }}
          >
            {PLOT_SHAPES.map((s) => (
              <PlotShapeCard
                key={s.id}
                shape={s}
                selected={shape === s.id}
                onSelect={(id) => {
                  patchLand({ shape: id });
                  if (id !== "irregular") {
                    // clear AI artefacts when leaving irregular
                    setRecogStatus("idle");
                    setDetected(null);
                  }
                }}
              />
            ))}
          </Box>

          {/* Irregular: AI upload + canvas */}
          <AnimatePresence>
            {shape === "irregular" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                style={{ overflow: "hidden" }}
              >
                <Box sx={{ mt: 2.5 }}>
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1.5}
                    sx={{ mb: 1.5 }}
                  >
                    <Button
                      component="label"
                      variant="outlined"
                      startIcon={<UploadFileIcon />}
                      disabled={recogStatus === "uploading"}
                    >
                      Upload plot photo / sketch
                      <input
                        type="file"
                        hidden
                        accept="image/jpeg,image/png,image/webp"
                        onChange={onShapeFile}
                      />
                    </Button>
                    {recogStatus === "uploading" && (
                      <Chip label="Detecting…" color="info" size="small" />
                    )}
                  </Stack>

                  {recogStatus === "uploading" && (
                    <LinearProgress sx={{ mb: 1.5, borderRadius: 1 }} />
                  )}

                  {detected?.error && (
                    <Alert severity="error" sx={{ mb: 1.5 }}>
                      {detected.error}
                    </Alert>
                  )}

                  {detected?.polygon && detected.polygon.length > 0 && (
                    <ShapeCanvas
                      detectedPolygon={detected.polygon}
                      confidence={detected.confidence}
                      mode={canvasMode}
                      onSwitchToManual={() => setCanvasMode("manual")}
                      onConfirm={(poly) => {
                        patchLand({ plotCoordinates: poly });
                      }}
                    />
                  )}

                  {recogStatus === "low_conf" && canvasMode === "detected" && (
                    <Alert severity="warning" sx={{ mt: 1.5 }}>
                      <AlertTitle>AI confidence below 70%</AlertTitle>
                      The detected polygon may be inaccurate. You can switch to
                      manual drawing using the button above the canvas.
                    </Alert>
                  )}
                </Box>
              </motion.div>
            )}
          </AnimatePresence>
        </Box>

        {/* Facing direction (compass) + Floors (slider) */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 4,
            alignItems: "center",
          }}
        >
          <Box>
            <Typography sx={{ fontWeight: 700, mb: 1.2 }}>
              Facing direction
            </Typography>
            <CompassSelector
              value={land.facingDirection}
              onChange={(d) => patchLand({ facingDirection: d })}
            />
          </Box>

          <Box>
            <Typography sx={{ fontWeight: 700, mb: 1.2 }}>
              Number of floors
            </Typography>
            <Box sx={{ px: 1 }}>
              <Slider
                value={land.floors ?? 1}
                onChange={(_e, v) => patchLand({ floors: v })}
                min={1}
                max={5}
                step={1}
                marks={[1, 2, 3, 4, 5].map((n) => ({
                  value: n,
                  label: String(n),
                }))}
                valueLabelDisplay="on"
                sx={{
                  "& .MuiSlider-valueLabel": {
                    background: theme.palette.primary.main,
                    fontWeight: 700,
                    borderRadius: 2,
                    transformOrigin: "bottom center",
                    transition: "transform .15s",
                  },
                  "& .MuiSlider-thumb": {
                    width: 22,
                    height: 22,
                    boxShadow: theme.vastu.glowPrimary,
                  },
                }}
              />
            </Box>
          </Box>
        </Box>

        {/* City + State */}
        <Box>
          <Typography sx={{ fontWeight: 700, mb: 1.2 }}>Location</Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: 2,
            }}
          >
            <Autocomplete
              freeSolo
              options={CITY_SUGGESTIONS}
              value={cityState.city || ""}
              onInputChange={(_e, v) => patchCityState({ city: v })}
              renderInput={(params) => <TextField {...params} label="City" />}
            />
            <FormControl fullWidth>
              <InputLabel id="step1-state">State</InputLabel>
              <Select
                labelId="step1-state"
                label="State"
                value={cityState.state || ""}
                onChange={(e) => patchCityState({ state: e.target.value })}
              >
                {INDIAN_STATES.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                FSI/FAR + municipal bye-laws auto-load.
              </FormHelperText>
            </FormControl>
          </Box>

          <AnimatePresence>
            {muniStatus === "loading" && (
              <motion.div
                key="muni-loading"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <LinearProgress sx={{ mt: 2, borderRadius: 1 }} />
              </motion.div>
            )}
            {muniStatus === "ok" && muniRules && (
              <motion.div
                key="muni-ok"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 30 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              >
                <Alert
                  severity="info"
                  sx={{ mt: 2, borderRadius: 1 }}
                  icon={<SelfImprovementIcon />}
                >
                  <AlertTitle>
                    Municipal rules — {cityState.city}, {cityState.state}
                  </AlertTitle>
                  <Stack
                    direction="row"
                    spacing={2}
                    flexWrap="wrap"
                    sx={{ gap: 1 }}
                  >
                    {muniRules.fsiLimit != null && (
                      <Chip size="small" label={`FSI ${muniRules.fsiLimit}`} />
                    )}
                    {muniRules.farLimit != null && (
                      <Chip size="small" label={`FAR ${muniRules.farLimit}`} />
                    )}
                    {muniRules.setbacks?.front != null && (
                      <Chip
                        size="small"
                        label={`Setback front ${muniRules.setbacks.front} m`}
                      />
                    )}
                    {muniRules.setbacks?.rear != null && (
                      <Chip
                        size="small"
                        label={`Setback rear ${muniRules.setbacks.rear} m`}
                      />
                    )}
                    {muniRules.setbacks?.side != null && (
                      <Chip
                        size="small"
                        label={`Setback side ${muniRules.setbacks.side} m`}
                      />
                    )}
                    {muniRules.maxHeight != null && (
                      <Chip
                        size="small"
                        label={`Max height ${muniRules.maxHeight} m`}
                      />
                    )}
                  </Stack>
                  {muniRules.dataSource && (
                    <Typography
                      variant="caption"
                      sx={{
                        display: "block",
                        mt: 1.5,
                        color: "text.secondary",
                      }}
                    >
                      Source: {muniRules.dataSource}
                    </Typography>
                  )}
                </Alert>
              </motion.div>
            )}
            {muniStatus === "missing" && (
              <motion.div
                key="muni-missing"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 30 }}
              >
                <Alert severity="warning" sx={{ mt: 2 }}>
                  Municipal rules for {cityState.city}, {cityState.state} aren't
                  in our dataset yet. NBC defaults will apply.
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>
        </Box>

        {/* Vastu toggle */}
        <Box
          sx={{
            p: 2.5,
            borderRadius: 1,
            border: `1px solid ${theme.palette.divider}`,
            background: vastuOn
              ? theme.palette.mode === "dark"
                ? "rgba(76,175,80,0.08)"
                : "rgba(46,125,50,0.05)"
              : "transparent",
            transition: "background .35s ease",
          }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ sm: "center" }}
            justifyContent="space-between"
            spacing={1.5}
          >
            <Box>
              <Typography sx={{ fontWeight: 700 }}>
                Apply Vastu compliance
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Door, kitchen, bedroom and pooja-room placement will follow
                Vastu rules. NBC norms always take precedence on conflicts.
              </Typography>
            </Box>
            <FormControlLabel
              control={
                <Switch
                  checked={vastuOn}
                  onChange={(e) => onChange({ vastuEnabled: e.target.checked })}
                  color="primary"
                />
              }
              label=""
              sx={{ m: 0 }}
            />
          </Stack>
        </Box>
      </Stack>
    </Card>
  );
}
