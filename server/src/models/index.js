/**
 * Central model registry. Requiring this file registers every Mongoose model
 * exactly once, so controllers/services can do:
 *   const { User, Plan } = require('../models');
 */

const User = require('./User');
const Plan = require('./Plan');
const PlanVersion = require('./PlanVersion');
const Comment = require('./Comment');
const Collaborator = require('./Collaborator');
const ContractorLink = require('./ContractorLink');
const Subscription = require('./Subscription');
const Payment = require('./Payment');
const ArchitectProfile = require('./ArchitectProfile');
const Bid = require('./Bid');
const ArchitectReview = require('./ArchitectReview');
const CostDataset = require('./CostDataset');
const MunicipalRule = require('./MunicipalRule');
const FeatureFlag = require('./FeatureFlag');
const ActivityLog = require('./ActivityLog');
const Project = require('./Project');

module.exports = {
  User,
  Plan,
  PlanVersion,
  Comment,
  Collaborator,
  ContractorLink,
  Subscription,
  Payment,
  ArchitectProfile,
  Bid,
  ArchitectReview,
  CostDataset,
  MunicipalRule,
  FeatureFlag,
  ActivityLog,
  Project,
};
