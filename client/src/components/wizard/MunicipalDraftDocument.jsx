import { Box, Paper, Stack, Typography, TextField, Divider } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { motion } from 'framer-motion';

const FIELD_LABELS = {
  plotNumber:     'Plot Number',
  surveyNumber:   'Survey / Khasra Number',
  localAuthority: 'Local Authority',
  ownerName:      'Owner Name',
};

/**
 * The drafted application document.
 *
 *   userFields    { plotNumber, surveyNumber, localAuthority, ownerName }
 *   onChange(uf)  invoked on every TextField edit (debounce upstream)
 *   draft         AI/system-filled fields from the report (landUseZone, BUA, FSI, …)
 *   plan          full plan (for city/state in header)
 *   editable      false → render the form fields as read-only (for previews/exports)
 */
export default function MunicipalDraftDocument({
  userFields = {},
  onChange,
  draft = {},
  plan = {},
  editable = true,
}) {
  const theme = useTheme();

  const setField = (k) => (e) => {
    onChange?.({ ...userFields, [k]: e.target.value });
  };

  return (
    <Box>
      {/* Top: user-fill form */}
      {editable && (
        <Box
          sx={{
            p: { xs: 2.5, md: 3 },
            mb: 2.5,
            background: theme.vastu.cardBg,
            border: theme.vastu.cardBorder,
            backdropFilter: theme.vastu.cardBlur,
            borderRadius: 3,
          }}
        >
          <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Applicant details</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Fill these four fields — they appear at the top of the application draft.
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
              gap: 2,
            }}
          >
            {Object.entries(FIELD_LABELS).map(([k, label]) => (
              <TextField
                key={k}
                label={label}
                size="small"
                fullWidth
                value={userFields[k] || ''}
                onChange={setField(k)}
                placeholder={k === 'surveyNumber' ? 'e.g. Khasra No. 44/2' : ''}
                inputProps={{ maxLength: 200 }}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Document preview */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <Paper
          elevation={4}
          sx={{
            position: 'relative',
            background: theme.palette.mode === 'dark' ? '#161A23' : '#FFFEFB',
            borderTop: `4px solid ${theme.palette.primary.main}`,
            borderRadius: 1,
            px: { xs: 3, md: 5 },
            py: { xs: 3, md: 4 },
            fontFamily: '"Times New Roman", Georgia, serif',
            color: 'text.primary',
            overflow: 'hidden',
            // Subtle paper texture
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: 0,
              background: theme.palette.mode === 'dark'
                ? 'repeating-linear-gradient(0deg, rgba(255,255,255,0.015) 0px, rgba(255,255,255,0.015) 1px, transparent 1px, transparent 28px)'
                : 'repeating-linear-gradient(0deg, rgba(0,0,0,0.025) 0px, rgba(0,0,0,0.025) 1px, transparent 1px, transparent 28px)',
              pointerEvents: 'none',
            },
          }}
        >
          {/* Header — centred official-document style */}
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography
              sx={{
                fontFamily: 'inherit',
                fontWeight: 800,
                letterSpacing: 2,
                fontSize: { xs: '1.3rem', md: '1.6rem' },
                textTransform: 'uppercase',
              }}
            >
              Application for Building Permit
            </Typography>
            <Typography
              sx={{
                fontFamily: 'inherit',
                fontStyle: 'italic',
                color: 'text.secondary',
                fontSize: '0.85rem',
                mt: 0.5,
              }}
            >
              (Indicative draft generated from VastuVerse wizard inputs)
            </Typography>
            <Divider sx={{ mt: 2, borderColor: 'text.disabled' }} />
          </Box>

          {/* Applicant section */}
          <Section title="I. Applicant & site details">
            <FieldRow label="Plot Number"     value={userFields.plotNumber || '—'} editable={editable} />
            <FieldRow label="Survey / Khasra" value={userFields.surveyNumber || '—'} editable={editable} />
            <FieldRow label="Local Authority" value={userFields.localAuthority || '—'} editable={editable} />
            <FieldRow label="Owner Name"      value={userFields.ownerName || '—'} editable={editable} />
            <FieldRow
              label="City / State"
              value={[plan.cityState?.city, plan.cityState?.state].filter(Boolean).join(', ') || '—'}
            />
          </Section>

          {/* Land use section (AI-filled) */}
          <Section title="II. Land use & development parameters">
            <FieldRow label="Land use zone"    value={draft.landUseZone || '—'} />
            <FieldRow label="Plot area"        value={draft.plotAreaSqft ? `${draft.plotAreaSqft.toLocaleString('en-IN')} sqft` : '—'} />
            <FieldRow label="Number of floors" value={String(draft.floors || 1)} />
            <FieldRow label="Proposed BUA"     value={draft.proposedBuaSqft ? `${draft.proposedBuaSqft.toLocaleString('en-IN')} sqft` : '—'} />
            <FieldRow label="FSI statement"    value={draft.fsiStatement || '—'} multiline />
            <FieldRow label="Setback note"     value={draft.setbackStatement || '—'} multiline />
            <FieldRow label="Ruleset"          value={draft.rulesetSource || 'NBC 2016 (default)'} />
          </Section>

          {/* Accommodation summary */}
          {draft.roomSummary && (
            <Section title="III. Proposed accommodation">
              <Typography
                sx={{
                  fontFamily: 'inherit',
                  fontSize: '1rem',
                  textAlign: 'justify',
                  lineHeight: 1.6,
                }}
              >
                {draft.roomSummary}.
              </Typography>
            </Section>
          )}

          {/* Footer */}
          <Box sx={{ mt: 4, textAlign: 'right' }}>
            <Typography
              sx={{
                fontFamily: 'inherit',
                fontStyle: 'italic',
                fontSize: '0.85rem',
                color: 'text.secondary',
              }}
            >
              Signature of applicant: ______________________________
            </Typography>
            <Typography
              sx={{
                fontFamily: 'inherit',
                fontStyle: 'italic',
                fontSize: '0.85rem',
                color: 'text.secondary',
                mt: 1,
              }}
            >
              Date: ___________________ &nbsp;&nbsp; Place: ___________________
            </Typography>
          </Box>
        </Paper>
      </motion.div>
    </Box>
  );
}

function Section({ title, children }) {
  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography
        sx={{
          fontFamily: 'inherit',
          fontWeight: 700,
          fontSize: '1rem',
          letterSpacing: 0.5,
          mb: 1.2,
          textTransform: 'uppercase',
          color: 'primary.main',
        }}
      >
        {title}
      </Typography>
      <Box>{children}</Box>
    </Box>
  );
}

function FieldRow({ label, value, multiline = false, editable = false }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '120px 1fr', sm: '180px 1fr' },
        gap: 1.5,
        py: 0.6,
        borderBottom: '1px dotted',
        borderColor: 'text.disabled',
        alignItems: 'baseline',
      }}
    >
      <Typography
        sx={{
          fontFamily: 'inherit',
          fontSize: '0.92rem',
          color: 'text.secondary',
          fontStyle: 'italic',
        }}
      >
        {label}:
      </Typography>
      <Typography
        sx={{
          fontFamily: 'inherit',
          fontSize: '0.98rem',
          fontWeight: editable ? 700 : 600,
          color: editable && value !== '—' ? 'primary.main' : 'text.primary',
          ...(multiline ? {} : { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }),
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}
