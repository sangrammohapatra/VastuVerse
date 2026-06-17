import { useForm, Controller } from 'react-hook-form';
import {
  Box, Stack, TextField, Button,
  FormControl, InputLabel, Select, MenuItem, FormHelperText,
} from '@mui/material';

import {
  INDIAN_STATES,
  LANGUAGES,
  PLOT_OWNERSHIP_OPTIONS,
  PHONE_RE,
} from '../../constants/indiaStates';

export default function HomeownerForm({ onSubmit, onBack, submitting }) {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      fullName: '',
      phone: '',
      city: '',
      state: '',
      plotOwnership: '',
      language: 'en',
    },
    mode: 'onTouched',
  });

  const submit = (data) =>
    onSubmit({
      fullName: data.fullName.trim(),
      phone: data.phone.trim(),
      cityState: { city: data.city.trim(), state: data.state },
      preferredLanguage: data.language,
      onboardingData: { plotOwnershipStatus: data.plotOwnership },
    });

  return (
    <Box component="form" onSubmit={handleSubmit(submit)} noValidate>
      <Stack spacing={2.5}>
        <Controller
          name="fullName"
          control={control}
          rules={{ required: 'Full name is required', minLength: { value: 2, message: 'Too short' } }}
          render={({ field }) => (
            <TextField
              {...field}
              label="Full name *"
              fullWidth
              autoComplete="name"
              error={!!errors.fullName}
              helperText={errors.fullName?.message}
            />
          )}
        />

        <Controller
          name="phone"
          control={control}
          rules={{
            required: 'Phone is required',
            pattern: { value: PHONE_RE, message: 'Enter a valid phone number' },
          }}
          render={({ field }) => (
            <TextField
              {...field}
              label="Phone (+91) *"
              fullWidth
              autoComplete="tel"
              placeholder="+91 98765 43210"
              error={!!errors.phone}
              helperText={errors.phone?.message}
            />
          )}
        />

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <Controller
            name="city"
            control={control}
            rules={{ required: 'City is required' }}
            render={({ field }) => (
              <TextField
                {...field}
                label="City *"
                fullWidth
                autoComplete="address-level2"
                error={!!errors.city}
                helperText={errors.city?.message}
              />
            )}
          />
          <Controller
            name="state"
            control={control}
            rules={{ required: 'State is required' }}
            render={({ field }) => (
              <FormControl fullWidth error={!!errors.state}>
                <InputLabel id="ho-state-label">State *</InputLabel>
                <Select labelId="ho-state-label" label="State *" {...field}>
                  {INDIAN_STATES.map((s) => (
                    <MenuItem key={s} value={s}>{s}</MenuItem>
                  ))}
                </Select>
                {errors.state && <FormHelperText>{errors.state.message}</FormHelperText>}
              </FormControl>
            )}
          />
        </Box>

        <Controller
          name="plotOwnership"
          control={control}
          rules={{ required: 'Please tell us your plot status' }}
          render={({ field }) => (
            <FormControl fullWidth error={!!errors.plotOwnership}>
              <InputLabel id="plot-label">Plot ownership status *</InputLabel>
              <Select labelId="plot-label" label="Plot ownership status *" {...field}>
                {PLOT_OWNERSHIP_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </Select>
              {errors.plotOwnership && (
                <FormHelperText>{errors.plotOwnership.message}</FormHelperText>
              )}
            </FormControl>
          )}
        />

        <Controller
          name="language"
          control={control}
          render={({ field }) => (
            <FormControl fullWidth>
              <InputLabel id="lang-label">Preferred language</InputLabel>
              <Select labelId="lang-label" label="Preferred language" {...field}>
                {LANGUAGES.map((l) => (
                  <MenuItem key={l.code} value={l.code}>{l.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        />

        <Stack direction="row" justifyContent="space-between" sx={{ pt: 1.5 }}>
          <Button onClick={onBack} disabled={submitting}>Back</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={submitting}
            size="large"
            sx={{ px: 4, fontWeight: 700 }}
          >
            Continue
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
