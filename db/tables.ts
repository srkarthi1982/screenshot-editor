/**
 * Screenshot Editor - capture, annotate, and edit screenshots.
 *
 * Design goals:
 * - Track original screenshots and edited versions.
 * - Store edit operations as JSON for possible re-edit.
 * - Good base for "projects" with multiple iterations.
 */

import { defineTable, column, NOW } from "astro:db";

export const ScreenshotProjects = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    userId: column.text(),

    title: column.text({ optional: true }),            // e.g. "Bug report for login page"
    description: column.text({ optional: true }),
    sourceDevice: column.text({ optional: true }),     // "MacBook", "Android", etc.
    sourceApp: column.text({ optional: true }),        // "Chrome", "VS Code"

    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const Screenshots = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    projectId: column.text({
      references: () => ScreenshotProjects.columns.id,
      optional: true,
    }),
    userId: column.text(),

    originalImageUrl: column.text(),                   // original screenshot
    editedImageUrl: column.text({ optional: true }),   // latest edited version (if any)

    width: column.number({ optional: true }),
    height: column.number({ optional: true }),

    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const ScreenshotEdits = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    screenshotId: column.text({
      references: () => Screenshots.columns.id,
    }),
    userId: column.text(),

    editType: column.text({ optional: true }),         // "crop", "highlight", "blur", "draw"
    operationsJson: column.text({ optional: true }),   // JSON describing operations
    resultImageUrl: column.text({ optional: true }),   // intermediate result if stored

    createdAt: column.date({ default: NOW }),
  },
});

export const tables = {
  ScreenshotProjects,
  Screenshots,
  ScreenshotEdits,
} as const;
