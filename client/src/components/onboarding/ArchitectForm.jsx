import { useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import {
  Box, Stack, TextField, Button, Typography,
  FormControl, InputLabel, Select, MenuItem, FormHelperText,
  IconButton, Alert,
} from '@mui/material';

import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ImageIcon from '@mui/icons-material/Image';

import { INDIAN_STATES, COA_RE, PHONE_RE } from '../../constants/indiaStates';

const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_MIME = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];

function FileRow({ file, onRemove }) {
  const isPdf = file.type === 'application/pdf';
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.5}
      sx={{
        p: 1,
        px: 1.5,
        border: (t) => `1px solid ${t.palette.divider}`,
        borderRadius: 2,
        background: (t) =>
          t.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
      }}
    >
      {isPdf ? (
        <PictureAsPdfIcon sx={{ color: 'secondary.main' }} />
      ) : (
        <ImageIcon sx={{ color: 'accent.main' }} />
      )}
      <Typography
        variant="body2"
        sx={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {file.name}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {(file.size / 1024 / 1024).toFixed(2)} MB
      </Typography>
      <IconButton size="small" onClick={onRemove} aria-label="remove file">
        <DeleteOutlineIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}

export default function ArchitectForm({ onSubmit, onBack, submitting }) {
  const {
    control, register, handleSubmit, formState: { errors },
  } = useForm({
    defaultValues: {
      fullName: '', phone: '', coa: '', years: '', city: '', state: '',
      certifications: [{ value: '' }],
    },
    mode: 'onTouched',
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'certifications',
  });

  const [files, setFiles] = useState([]);
  const [fileError, setFileError] = useState('');

  const onFilesPicked = (e) => {
    setFileError('');
    const picked = Array.from(e.target.files || []);
    if (!picked.length) return;
    if (files.length + picked.length > MAX_FILES) {
      setFileError(`Maximum ${MAX_FILES} files allowed.`);
      e.target.value = '';
      return;
    }
    const tooBig = picked.find((f) => f.size > MAX_FILE_BYTES);
    if (tooBig) {
      setFileError(`"${tooBig.name}" exceeds the 10 MB limit.`);
      e.target.value = '';
      return;
    }
    const badType = picked.find((f) => !ACCEPTED_MIME.includes(f.type));
    if (badType) {
      setFileError(`Unsupported file type: ${badType.name}`);
      e.target.value = '';
      return;
    }
    setFiles((curr) => [...curr, ...picked]);
    e.target.value = '';
  };

  const removeFile = (idx) => setFiles((curr) => curr.filter((_, i) => i !== idx));

  const submit = (data) => {
    if (files.length === 0) {
      setFileError('Please upload at least one portfolio file.');
      return;
    }
    onSubmit({
      fullName: data.fullName.trim(),
      phone: data.phone.trim(),
      cityState: { city: data.city.trim(), state: data.state },
      onboardingData: {
        coaRegistrationNo: data.coa.toUpperCase().trim(),
        yearsExperience: Number(data.years),
        certifications: data.certifications
          .map((c) => (c.value || '').trim())
          .filter(Boolean),
        verificationStatus: 'pending',
      },
      _files: files, // OnboardingPage handles multipart upload
    });
  };

  return (
    <Box component="form" onSubmit={handleSubmit(submit)} noValidate>
      <Stack spacing={2.5}>
        <Controller
          name="fullName" control={control}
          rules={{ required: 'Full name is required' }}
          render={({ field }) => (
            <TextField {...field} label="Full name *" fullWidth
              autoComplete="name"
              error={!!errors.fullName} helperText={errors.fullName?.message} />
          )}
        />
        <Controller
          name="phone" control={control}
          rules={{ required: 'Phone is required', pattern: { value: PHONE_RE, message: 'Enter a valid phone number' } }}
          render={({ field }) => (
            <TextField {...field} label="Phone *" fullWidth autoComplete="tel"
              error={!!errors.phone} helperText={errors.phone?.message} />
          )}
        />

        <Controller
          name="coa" control={control}
          rules={{
            required: 'CoA registration number is required',
            pattern: { value: COA_RE, message: 'Format: XXXXX/YYYY (e.g. CA1234/2024)' },
          }}
          render={({ field }) => (
            <TextField {...field}
              onChange={(e) => field.onChange(e.target.value.toUpperCase())}
              label="CoA Registration No (XXXXX/YYYY) *" fullWidth
              error={!!errors.coa}
              helperText={errors.coa?.message || 'Council of Architecture registration'}
            />
          )}
        />

        <Controller
          name="years" control={control}
          rules={{
            required: 'Years of experience is required',
            validate: (v) =>
              (!Number.isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= 80) ||
              'Enter a number between 0 and 80',
          }}
          render={({ field }) => (
            <TextField {...field} type="number" label="Years of experience *" fullWidth
              inputProps={{ min: 0, max: 80 }}
              error={!!errors.years} helperText={errors.years?.message} />
          )}
        />

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <Controller
            name="city" control={control}
            rules={{ required: 'City is required' }}
            render={({ field }) => (
              <TextField {...field} label="City *" fullWidth
                autoComplete="address-level2"
                error={!!errors.city} helperText={errors.city?.message} />
            )}
          />
          <Controller
            name="state" control={control}
            rules={{ required: 'State is required' }}
            render={({ field }) => (
              <FormControl fullWidth error={!!errors.state}>
                <InputLabel id="arch-state-label">State *</InputLabel>
                <Select labelId="arch-state-label" label="State *" {...field}>
                  {INDIAN_STATES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </Select>
                {errors.state && <FormHelperText>{errors.state.message}</FormHelperText>}
              </FormControl>
            )}
          />
        </Box>

        {/* Portfolio upload */}
        <Box>
          <Typography sx={{ fontWeight: 600, mb: 1 }}>
            Portfolio (PDF / JPG / PNG · max {MAX_FILES} files · 10 MB each) *
          </Typography>
          <Button
            component="label"
            variant="outlined"
            startIcon={<UploadFileIcon />}
            disabled={files.length >= MAX_FILES}
            sx={{ borderWidth: 2, '&:hover': { borderWidth: 2 } }}
          >
            {files.length === 0 ? 'Upload files' : 'Add more files'}
            <input
              type="file"
              hidden
              multiple
              accept={ACCEPTED_MIME.join(',')}
              onChange={onFilesPicked}
            />
          </Button>
          {fileError && (
            <Alert severity="error" sx={{ mt: 1.5 }}>{fileError}</Alert>
          )}
          {files.length > 0 && (
            <Stack sx={{ mt: 1.5, gap: 1 }}>
              {files.map((f, i) => (
                <FileRow key={`${f.name}-${i}`} file={f} onRemove={() => removeFile(i)} />
              ))}
            </Stack>
          )}
        </Box>

        {/* Certifications (dynamic add/remove) */}
        <Box>
          <Typography sx={{ fontWeight: 600, mb: 1 }}>Certifications</Typography>
          <Stack spacing={1.5}>
            {fields.map((f, i) => (
              <Stack key={f.id} direction="row" spacing={1} alignItems="center">
                <TextField
                  fullWidth size="small"
                  placeholder={`Certification ${i + 1}`}
                  {...register(`certifications.${i}.value`)}
                />
                <IconButton
                  onClick={() => remove(i)}
                  aria-label="remove certification"
                  disabled={fields.length === 1}
                >
                  <DeleteOutlineIcon />
                </IconButton>
              </Stack>
            ))}
            <Button
              startIcon={<AddIcon />}
              onClick={() => append({ value: '' })}
              sx={{ alignSelf: 'flex-start' }}
              disabled={fields.length >= 10}
            >
              Add certification
            </Button>
          </Stack>
        </Box>

        <Stack direction="row" justifyContent="space-between" sx={{ pt: 1.5 }}>
          <Button onClick={onBack} disabled={submitting}>Back</Button>
          <Button
            type="submit" variant="contained"
            disabled={submitting} size="large"
            sx={{ px: 4, fontWeight: 700 }}
          >
            Submit for verification
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
