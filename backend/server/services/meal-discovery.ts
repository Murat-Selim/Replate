import { MEAL_GROUPS, scoreMeal } from "./meal-analysis.js";

export const MEAL_DESCRIPTION = "Analyze a meal photo for visible foods, estimated food-group shares, missing groups, plant diversity and a balance score. Returns JSON with one practical suggestion. No receipt, Replate account or receipt verification is required. Visual estimates only; no exact calories or medical assessment.";

export const MEAL_INPUT_SCHEMA = {
  type: "object",
  required: ["imageBase64"],
  properties: {
    imageBase64: {
      type: "string", minLength: 1,
      description: "JPEG, PNG or WebP meal photo as base64, optionally with a data URL prefix. The base64 image payload is limited to 700000 characters.",
    },
  },
  additionalProperties: false,
};

const group = { type: "string", enum: MEAL_GROUPS };
const strings = { type: "array", items: { type: "string" } };
export const MEAL_RESPONSE_SCHEMA = {
  type: "object",
  required: ["success", "data"],
  properties: {
    success: { type: "boolean", const: true },
    data: {
      type: "object",
      required: ["detectedLabels", "components", "balanceScore", "confidence", "insight", "recommendation", "plate", "items", "missingGroups", "diversity", "informationalOnly"],
      properties: {
        detectedLabels: { type: "array", items: {
          type: "object", required: ["label", "confidence"],
          properties: { label: { type: "string" }, confidence: { type: "number", minimum: 0, maximum: 1 } },
        } },
        components: { type: "array", items: group },
        balanceScore: { type: "integer", minimum: 0, maximum: 100 },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        insight: { type: "string" },
        recommendation: { type: "string" },
        plate: { type: "array", items: {
          type: "object", required: ["group", "share"],
          properties: { group, share: { type: "integer", minimum: 0, maximum: 100 } },
        } },
        items: { type: "array", items: {
          type: "object", required: ["name", "group"], properties: { name: { type: "string" }, group },
        } },
        missingGroups: { type: "array", items: group },
        diversity: {
          type: "object", required: ["plantCount", "plants", "colors"],
          properties: { plantCount: { type: "integer", minimum: 0 }, plants: strings, colors: strings },
        },
        informationalOnly: { type: "boolean", const: true },
      },
    },
  },
};

// A tiny PNG is only a transport example; paid callers supply their own meal photo.
export const MEAL_INPUT_EXAMPLE = {
  imageBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6x0AAAAASUVORK5CYII=",
};
export const MEAL_RESPONSE_EXAMPLE = {
  success: true,
  data: scoreMeal({
    items: [
      { name: "broccoli", group: "vegetables", share: 50 },
      { name: "salmon", group: "protein", share: 25 },
      { name: "brown rice", group: "grains", share: 25 },
    ],
    plants: ["broccoli", "brown rice"], colors: ["green", "brown"], visibility: "clear", additions: {},
  }),
};
