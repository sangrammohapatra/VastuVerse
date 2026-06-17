const mongoose = require('mongoose');

const { Schema } = mongoose;

const StepStateSchema = new Schema(
  {
    completed: { type: Boolean, default: false },
    completedAt: { type: Date },
  },
  { _id: false }
);

const CityStateSchema = new Schema(
  {
    city: { type: String, trim: true },
    state: { type: String, trim: true },
  },
  { _id: false }
);

const PointSchema = new Schema(
  { x: { type: Number }, y: { type: Number } },
  { _id: false }
);

const LandDetailsSchema = new Schema(
  {
    area: { type: Number, min: 0 },
    unit: { type: String, enum: ['sqft', 'sqm', 'sqyd', 'acre', 'cent', 'ground'], default: 'sqft' },
    shape: { type: String, enum: ['rectangular', 'square', 'L-shaped', 'irregular', 'corner', 'trapezoidal'] },
    plotCoordinates: { type: [PointSchema], default: undefined },
    facingDirection: { type: String, enum: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] },
    floors: { type: Number, min: 0, max: 100 },
    fsi: { type: Number, min: 0 },
    far: { type: Number, min: 0 },
    setbacks: { type: Schema.Types.Mixed }, // { front, rear, side, ... } in metres
  },
  { _id: false }
);

// Step 2 — room requirements + multi-storey floor distribution
const RoomConfigSchema = new Schema(
  {
    bedrooms:          { type: Number, min: 0, max: 20 },
    attachedBathrooms: { type: Number, min: 0, max: 20 },
    commonBathrooms:   { type: Number, min: 0, max: 10 },
    kitchenType:       { type: String, enum: ['modular', 'open', 'traditional'] },
    // ids of selected additional spaces (e.g. 'living','dining','pooja','study','garage','servant','terrace','storage')
    additionalSpaces:  { type: [String], default: [] },
    balconies:         { type: Number, min: 0, max: 20 },
    staircases:        { type: Number, min: 0, max: 5 },
    // Per-floor room id assignments: { floor1: ['bed-1','kitchen'], floor2: [...], unassigned: [...] }
    floorAssignments:  { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { _id: false }
);


const PlanSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null, index: true }, // developer bulk projects
    title: { type: String, trim: true, default: 'Untitled Plan', maxlength: 160 },

    status: {
      type: String,
      enum: ['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED'],
      default: 'DRAFT',
      index: true,
    },

    currentVersionId: { type: Schema.Types.ObjectId, ref: 'PlanVersion', default: null },

    stepProgress: {
      step1: { type: StepStateSchema, default: () => ({}) },
      step2: { type: StepStateSchema, default: () => ({}) },
      step3: { type: StepStateSchema, default: () => ({}) },
      step4: { type: StepStateSchema, default: () => ({}) },
      step5: { type: StepStateSchema, default: () => ({}) },
      step6: { type: StepStateSchema, default: () => ({}) },
      step7: { type: StepStateSchema, default: () => ({}) },
      step8: { type: StepStateSchema, default: () => ({}) }, // 3D
      step9: { type: StepStateSchema, default: () => ({}) }, // Municipal
      step10: { type: StepStateSchema, default: () => ({}) },
    },

    vastuEnabled: { type: Boolean, default: false },
    cityState: { type: CityStateSchema, default: () => ({}) },
    landDetails: { type: LandDetailsSchema, default: () => ({}) },
    roomConfig: { type: RoomConfigSchema, default: () => ({}) },

    // Step 3 — AI-generated floor plan options (Mixed for layout flexibility)
    // shape: { options: [{ id, variant, rooms: [{ id, label, kind, floor, x, y, w, h, color }],
    //                      floors: [{ w, h }], plotDimensions, imageUrl? }],
    //          selectedOptionId, jobId, generatedAt }
    floorPlan: { type: Schema.Types.Mixed, default: () => ({}) },

    // Step 4 — interior design
    // shape: { globalStyle, perRoomStyles: { [roomId]: style }, kitchenConfig: { layout, appliances[] },
    //          selectedPaletteId, palettes: [{ id, name, colors[] }],
    //          rooms: { [roomId]: { imageUrl, jobId, status, generatedAt } } }
    interior: { type: Schema.Types.Mixed, default: () => ({}) },

    // Step 5 — exterior design
    // shape: { facadeStyle, roofType, boundaryWall, mainGate, driveway: { enabled, material },
    //          landscaping: [features],
    //          sides: { front: { imageUrl, jobId, status, generatedAt },
    //                   left:  { ... }, right: { ... } } }
    exterior: { type: Schema.Types.Mixed, default: () => ({}) },

    // Step 6 — utilities (MEP overlay)
    // shape: { jobId, generatedAt,
    //          summary: { plumbing, electrical, hvac, waterTanks, sewage, solar },
    //          layers: { plumbing: { paths, markers, color }, electrical: {...}, ... } }
    utilities: { type: Schema.Types.Mixed, default: () => ({}) },

    // Step 7 — cost estimate
    // shape: { finishTier, asOf, buaSqft, categories: { civil: {...}, electrical: {...}, ... },
    //          totalInr, varianceInr, state, generatedAt }
    costEstimate: { type: Schema.Types.Mixed, default: () => ({}) },

    // Step 9 — municipal compliance report + user-fillable draft fields
    // shape: { generatedAt, summary, items: [...], draft: {...},
    //          userFields: { plotNumber, surveyNumber, localAuthority, ownerName } }
    municipalReport: { type: Schema.Types.Mixed, default: () => ({}) },

    collaborators: [{ type: Schema.Types.ObjectId, ref: 'Collaborator' }],
    contractorLinks: [{ type: Schema.Types.ObjectId, ref: 'ContractorLink' }],

    is3DUnlocked: { type: Boolean, default: false },

    // Step 8 — bird's-eye AI render (set by worker after queue job completes)
    // shape: { imageUrl, jobId, provider, seed, generatedAt }
    birdEyeView: { type: Schema.Types.Mixed, default: () => ({}) },

    // Read-only share links per surface — keyed by surface ('threeD', etc.)
    // shape: { threeD: { token, createdAt, expiresAt } }
    shareTokens: { type: Schema.Types.Mixed, default: () => ({}) },

    completedAt: { type: Date },
    archivedAt: { type: Date },
  },
  { timestamps: true }
);

// Compound indexes for the hot query paths
PlanSchema.index({ userId: 1, status: 1 });
PlanSchema.index({ userId: 1, createdAt: -1 });
PlanSchema.index({ projectId: 1, status: 1 });

module.exports = mongoose.models.Plan || mongoose.model('Plan', PlanSchema);
