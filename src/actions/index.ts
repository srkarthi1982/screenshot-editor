import { defineAction, ActionError, type ActionAPIContext } from "astro:actions";
import { z } from "astro:schema";
import { ScreenshotEdits, ScreenshotProjects, Screenshots, and, db, eq } from "astro:db";

function requireUser(context: ActionAPIContext) {
  const locals = context.locals as App.Locals | undefined;
  const user = locals?.user;

  if (!user) {
    throw new ActionError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    });
  }

  return user;
}

async function getOwnedProject(projectId: string, userId: string) {
  const [project] = await db
    .select()
    .from(ScreenshotProjects)
    .where(and(eq(ScreenshotProjects.id, projectId), eq(ScreenshotProjects.userId, userId)));

  if (!project) {
    throw new ActionError({
      code: "NOT_FOUND",
      message: "Project not found.",
    });
  }

  return project;
}

async function getOwnedScreenshot(screenshotId: string, userId: string) {
  const [shot] = await db
    .select()
    .from(Screenshots)
    .where(and(eq(Screenshots.id, screenshotId), eq(Screenshots.userId, userId)));

  if (!shot) {
    throw new ActionError({
      code: "NOT_FOUND",
      message: "Screenshot not found.",
    });
  }

  return shot;
}

export const server = {
  createProject: defineAction({
    input: z.object({
      title: z.string().optional(),
      description: z.string().optional(),
      sourceDevice: z.string().optional(),
      sourceApp: z.string().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const now = new Date();

      const [project] = await db
        .insert(ScreenshotProjects)
        .values({
          id: crypto.randomUUID(),
          userId: user.id,
          title: input.title,
          description: input.description,
          sourceDevice: input.sourceDevice,
          sourceApp: input.sourceApp,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      return { success: true, data: { project } };
    },
  }),

  updateProject: defineAction({
    input: z
      .object({
        id: z.string().min(1),
        title: z.string().optional(),
        description: z.string().optional(),
        sourceDevice: z.string().optional(),
        sourceApp: z.string().optional(),
      })
      .refine(
        (input) =>
          input.title !== undefined ||
          input.description !== undefined ||
          input.sourceDevice !== undefined ||
          input.sourceApp !== undefined,
        { message: "At least one field must be provided to update." }
      ),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedProject(input.id, user.id);

      const [project] = await db
        .update(ScreenshotProjects)
        .set({
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.sourceDevice !== undefined ? { sourceDevice: input.sourceDevice } : {}),
          ...(input.sourceApp !== undefined ? { sourceApp: input.sourceApp } : {}),
          updatedAt: new Date(),
        })
        .where(eq(ScreenshotProjects.id, input.id))
        .returning();

      return { success: true, data: { project } };
    },
  }),

  listProjects: defineAction({
    input: z.object({}).optional(),
    handler: async (_input, context) => {
      const user = requireUser(context);

      const projects = await db
        .select()
        .from(ScreenshotProjects)
        .where(eq(ScreenshotProjects.userId, user.id));

      return { success: true, data: { items: projects, total: projects.length } };
    },
  }),

  createScreenshot: defineAction({
    input: z.object({
      projectId: z.string().optional(),
      originalImageUrl: z.string().min(1),
      editedImageUrl: z.string().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      if (input.projectId) {
        await getOwnedProject(input.projectId, user.id);
      }
      const now = new Date();

      const [screenshot] = await db
        .insert(Screenshots)
        .values({
          id: crypto.randomUUID(),
          projectId: input.projectId ?? null,
          userId: user.id,
          originalImageUrl: input.originalImageUrl,
          editedImageUrl: input.editedImageUrl,
          width: input.width,
          height: input.height,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      return { success: true, data: { screenshot } };
    },
  }),

  updateScreenshot: defineAction({
    input: z
      .object({
        id: z.string().min(1),
        projectId: z.string().optional(),
        editedImageUrl: z.string().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
      })
      .refine(
        (input) =>
          input.projectId !== undefined ||
          input.editedImageUrl !== undefined ||
          input.width !== undefined ||
          input.height !== undefined,
        { message: "At least one field must be provided to update." }
      ),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [existing] = await db
        .select()
        .from(Screenshots)
        .where(and(eq(Screenshots.id, input.id), eq(Screenshots.userId, user.id)));

      if (!existing) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Screenshot not found.",
        });
      }

      if (input.projectId !== undefined && input.projectId !== null) {
        await getOwnedProject(input.projectId, user.id);
      }

      const [screenshot] = await db
        .update(Screenshots)
        .set({
          ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
          ...(input.editedImageUrl !== undefined ? { editedImageUrl: input.editedImageUrl } : {}),
          ...(input.width !== undefined ? { width: input.width } : {}),
          ...(input.height !== undefined ? { height: input.height } : {}),
          updatedAt: new Date(),
        })
        .where(eq(Screenshots.id, input.id))
        .returning();

      return { success: true, data: { screenshot } };
    },
  }),

  listScreenshots: defineAction({
    input: z.object({
      projectId: z.string().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      if (input.projectId) {
        await getOwnedProject(input.projectId, user.id);
      }

      const filters = [eq(Screenshots.userId, user.id)];
      if (input.projectId) {
        filters.push(eq(Screenshots.projectId, input.projectId));
      }

      const screenshots = await db.select().from(Screenshots).where(and(...filters));

      return { success: true, data: { items: screenshots, total: screenshots.length } };
    },
  }),

  createScreenshotEdit: defineAction({
    input: z.object({
      screenshotId: z.string().min(1),
      editType: z.string().optional(),
      operationsJson: z.string().optional(),
      resultImageUrl: z.string().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedScreenshot(input.screenshotId, user.id);

      const [edit] = await db
        .insert(ScreenshotEdits)
        .values({
          id: crypto.randomUUID(),
          screenshotId: input.screenshotId,
          userId: user.id,
          editType: input.editType,
          operationsJson: input.operationsJson,
          resultImageUrl: input.resultImageUrl,
          createdAt: new Date(),
        })
        .returning();

      return { success: true, data: { edit } };
    },
  }),

  listScreenshotEdits: defineAction({
    input: z.object({
      screenshotId: z.string().min(1),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedScreenshot(input.screenshotId, user.id);

      const edits = await db
        .select()
        .from(ScreenshotEdits)
        .where(eq(ScreenshotEdits.screenshotId, input.screenshotId));

      return { success: true, data: { items: edits, total: edits.length } };
    },
  }),
};
