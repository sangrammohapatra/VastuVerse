const mongoose = require('mongoose');

const { Schema } = mongoose;

const LocationSchema = new Schema(
  {
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    address: { type: String, trim: true },
  },
  { _id: false }
);

const TeamMemberSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    teamRole: { type: String, enum: ['admin', 'editor', 'reviewer', 'viewer'], default: 'viewer', required: true },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ProjectSchema = new Schema(
  {
    developerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    location: { type: LocationSchema, default: () => ({}) },

    planIds: [{ type: Schema.Types.ObjectId, ref: 'Plan' }],
    teamMembers: { type: [TeamMemberSchema], default: [] },

    templateId: { type: Schema.Types.ObjectId, ref: 'Plan', default: null },

    clientPortalEnabled: { type: Boolean, default: false },
    clientPortalToken: { type: String, select: false, default: null },

    status: { type: String, enum: ['active', 'archived', 'completed'], default: 'active', index: true },
  },
  { timestamps: true }
);

ProjectSchema.index({ developerId: 1, status: 1 });
ProjectSchema.index({ 'teamMembers.userId': 1 });
ProjectSchema.index({ clientPortalToken: 1 }, { unique: true, sparse: true });

module.exports = mongoose.models.Project || mongoose.model('Project', ProjectSchema);
