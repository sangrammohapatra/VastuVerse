import { useForm, Controller } from 'react-hook-form';
import {
  Box, Stack, TextField, Button, Chip,
  FormControl, InputLabel, Select, MenuItem, FormHelperText,
} from '@mui/material';

import {
  INDIAN_STATES, PROJECT_TYPES, TEAM_SIZES, GSTIN_RE, PHONE_RE,
} from '../../constants/indiaStates';

const teamSizeToNumber = (label) => {
  if (!label) return undefined;
  // "11-50" -> 50; "500+" -> 500
  const m = label.match(/(\d+)/g);
  return m ? Number(m[m.length - 1]) : undefined;
};

export default function DeveloperForm({ onSubmit, onBack, submitting }) {
  const {
    control, handleSubmit, formState: { errors },
  } = useForm({
    defaultValues: {
      companyName: '', gstin: '', designation: '', teamSize: '',
      primaryRegions: [], projectTypes: [], phone: '',
    },
    mode: 'onTouched',
  });

  const submit = (data) =>
    onSubmit({
      phone: data.phone.trim(),
      onboardingData: {
        companyName: data.companyName.trim(),
        gstin: data.gstin.toUpperCase().trim(),
        designation: data.designation.trim(),
        teamSize: teamSizeToNumber(data.teamSize),
        primaryRegions: data.primaryRegions,
        projectTypes: data.projectTypes,
      },
    });

  return (
    <Box component="form" onSubmit={handleSubmit(submit)} noValidate>
      <Stack spacing={2.5}>
        <Controller
          name="companyName" control={control}
          rules={{ required: 'Company name is required' }}
          render={({ field }) => (
            <TextField {...field} label="Company name *" fullWidth
              autoComplete="organization"
              error={!!errors.companyName} helperText={errors.companyName?.message} />
          )}
        />

        <Controller
          name="gstin" control={control}
          rules={{ required: 'GSTIN is required', pattern: { value: GSTIN_RE, message: 'Invalid GSTIN format' } }}
          render={({ field }) => (
            <TextField
              {...field}
              onChange={(e) => field.onChange(e.target.value.toUpperCase())}
              label="GSTIN (15 characters) *"
              fullWidth
              inputProps={{ maxLength: 15, style: { letterSpacing: 1 } }}
              error={!!errors.gstin}
              helperText={errors.gstin?.message || 'Example: 22AAAAA0000A1Z5'}
            />
          )}
        />

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <Controller
            name="designation" control={control}
            rules={{ required: 'Designation is required' }}
            render={({ field }) => (
              <TextField {...field} label="Your designation *" fullWidth
                autoComplete="organization-title"
                error={!!errors.designation} helperText={errors.designation?.message} />
            )}
          />
          <Controller
            name="teamSize" control={control}
            render={({ field }) => (
              <FormControl fullWidth>
                <InputLabel id="team-label">Team size</InputLabel>
                <Select labelId="team-label" label="Team size" {...field}>
                  {TEAM_SIZES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                </Select>
              </FormControl>
            )}
          />
        </Box>

        <Controller
          name="primaryRegions" control={control}
          rules={{ validate: (v) => (v && v.length > 0) || 'Pick at least one region' }}
          render={({ field }) => (
            <FormControl fullWidth error={!!errors.primaryRegions}>
              <InputLabel id="regions-label">Primary operating regions *</InputLabel>
              <Select
                labelId="regions-label" label="Primary operating regions *"
                multiple {...field}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {selected.map((v) => <Chip key={v} label={v} size="small" />)}
                  </Box>
                )}
              >
                {INDIAN_STATES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
              {errors.primaryRegions && (
                <FormHelperText>{errors.primaryRegions.message}</FormHelperText>
              )}
            </FormControl>
          )}
        />

        <Controller
          name="projectTypes" control={control}
          rules={{ validate: (v) => (v && v.length > 0) || 'Pick at least one project type' }}
          render={({ field }) => (
            <FormControl fullWidth error={!!errors.projectTypes}>
              <InputLabel id="ptypes-label">Project types *</InputLabel>
              <Select
                labelId="ptypes-label" label="Project types *"
                multiple {...field}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {selected.map((v) => <Chip key={v} label={v} size="small" />)}
                  </Box>
                )}
              >
                {PROJECT_TYPES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
              {errors.projectTypes && (
                <FormHelperText>{errors.projectTypes.message}</FormHelperText>
              )}
            </FormControl>
          )}
        />

        <Controller
          name="phone" control={control}
          rules={{ required: 'Phone is required', pattern: { value: PHONE_RE, message: 'Enter a valid phone number' } }}
          render={({ field }) => (
            <TextField {...field} label="Phone *" fullWidth autoComplete="tel"
              placeholder="+91 98765 43210"
              error={!!errors.phone} helperText={errors.phone?.message} />
          )}
        />

        <Stack direction="row" justifyContent="space-between" sx={{ pt: 1.5 }}>
          <Button onClick={onBack} disabled={submitting}>Back</Button>
          <Button
            type="submit" variant="contained"
            disabled={submitting} size="large"
            sx={{ px: 4, fontWeight: 700 }}
          >
            Continue
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
