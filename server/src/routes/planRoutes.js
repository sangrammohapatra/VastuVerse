const express = require("express");

const { authenticateToken } = require("../middlewares/auth");
const c = require("../controllers/planController");
const ai = require("../controllers/aiController");
const cost = require("../controllers/costController");
const municipal = require("../controllers/municipalController");
const finalize = require("../controllers/finalizeController");

const router = express.Router();
router.use(authenticateToken);

router.post("/", c.createPlan);
router.get("/",  c.listPlans);
router.get("/:planId", c.getPlan);
router.put("/:planId/steps/:stepName", c.saveStep);

// Per-step generation kick-offs
router.post("/:planId/generate/floor-plan", ai.enqueueFloorPlanGeneration);
router.post("/:planId/generate/interior",   ai.enqueueInteriorGeneration);
router.post("/:planId/generate/exterior",   ai.enqueueExteriorGeneration);
router.post("/:planId/generate/utilities",  ai.enqueueUtilitiesGeneration);
router.post("/:planId/generate/bird-eye",   ai.enqueueBirdEyeGeneration);
router.post("/:planId/generate/municipal-checklist", municipal.generateMunicipalChecklist);

// Cost estimate (synchronous + cached) + PDF export
router.get("/:planId/cost-estimate",   cost.getCostEstimate);
router.get("/:planId/export/cost-pdf", cost.exportCostPdf);

// Municipal compliance PDF (24h cached on report; PDF streamed)
router.get("/:planId/export/municipal-pdf", municipal.exportMunicipalPdf);

// 3D share token
router.post("/:planId/share-3d", c.shareThreeDView);

// Versions, status, contractor links, full plan PDF (Step 10)
router.get("/:planId/versions",                       finalize.listVersions);
router.put("/:planId/versions/:versionId/rollback",   finalize.rollback);
router.put("/:planId/status",                         finalize.updateStatus);
router.post("/:planId/contractor-links",              finalize.createContractorLink);
router.get("/:planId/contractor-links",               finalize.listContractorLinks);
router.get("/:planId/export/full-pdf",                finalize.exportFullPdf);

module.exports = router;
