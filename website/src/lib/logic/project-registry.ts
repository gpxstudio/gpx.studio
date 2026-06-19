import Dexie, { liveQuery } from 'dexie';
import { browser } from '$app/environment';
import { get, readable, writable, type Readable, type Writable } from 'svelte/store';
import { createProjectDatabase, type Database } from '$lib/db';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ProjectMeta {
    id: string;
    name: string;
    createdAt: number;
    updatedAt: number;
}

// ── Registry Database ──────────────────────────────────────────────────────

class RegistryDatabase extends Dexie {
    projects!: Dexie.Table<ProjectMeta, string>;

    constructor() {
        super('gpxstudio-registry');
        this.version(1).stores({
            projects: 'id, name, createdAt, updatedAt',
        });
    }
}

export const registryDb = new RegistryDatabase();

// ── Active project ID (persisted in localStorage) ─────────────────────────

const ACTIVE_PROJECT_KEY = 'gpxstudio-active-project';

export const activeProjectId: Writable<string> = writable(
    browser ? (localStorage.getItem(ACTIVE_PROJECT_KEY) ?? '') : ''
);

activeProjectId.subscribe((id) => {
    if (browser && id) {
        localStorage.setItem(ACTIVE_PROJECT_KEY, id);
    }
});

// ── Project registry store (liveQuery-backed) ─────────────────────────────

export const projectRegistry: Readable<ProjectMeta[]> = readable<ProjectMeta[]>([], (set) => {
    if (!browser) return;
    const subscription = liveQuery(() =>
        registryDb.projects.orderBy('createdAt').toArray()
    ).subscribe((projects) => set(projects));
    return () => subscription.unsubscribe();
});

// ── Initialization + migration ─────────────────────────────────────────────

/**
 * Called once on app startup.
 * 1. Migrates the legacy 'Database' IndexedDB to 'gpxstudio-project-0' if it exists.
 * 2. Ensures at least one project exists in the registry.
 * 3. Sets activeProjectId from localStorage or defaults to the first project.
 * Returns the Database instance for the active project.
 */
export async function initializeProjects(): Promise<Database> {
    // Step 1: Migrate legacy DB if it exists
    const legacyExists = await Dexie.exists('Database');
    if (legacyExists) {
        await migrateLegacyDatabase();
    }

    // Step 2: Ensure at least one project exists
    const count = await registryDb.projects.count();
    if (count === 0) {
        await registryDb.projects.add({
            id: 'project-0',
            name: 'Project 1',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
    }

    // Step 3: Resolve active project ID
    const allProjects = await registryDb.projects.orderBy('createdAt').toArray();
    const storedId = browser ? localStorage.getItem(ACTIVE_PROJECT_KEY) : null;
    const validId = allProjects.find((p) => p.id === storedId)?.id ?? allProjects[0].id;
    activeProjectId.set(validId);

    return createProjectDatabase(validId);
}

// ── Legacy migration ───────────────────────────────────────────────────────

async function migrateLegacyDatabase(): Promise<void> {
    // Open legacy DB with the original schema (version 1 only)
    const legacyDb = new Dexie('Database');
    legacyDb.version(1).stores({
        fileids: ',&fileid',
        files: '',
        patches: ',patch',
        settings: '',
        overpasstiles: '[query+x+y],[x+y]',
        overpassdata: '[query+id]',
    });

    try {
        await legacyDb.open();

        // Create the target project-0 DB
        const targetDb = createProjectDatabase('project-0');
        await targetDb.open();

        // Copy fileids
        const fileids = await (legacyDb as any).table('fileids').toArray();
        if (fileids.length > 0) {
            await targetDb.fileids.bulkPut(fileids);
        }

        // Copy files
        const files = await (legacyDb as any).table('files').toArray();
        if (files.length > 0) {
            await targetDb.files.bulkPut(files);
        }

        // Copy patches
        const patches = await (legacyDb as any).table('patches').toArray();
        if (patches.length > 0) {
            await targetDb.patches.bulkPut(patches);
        }

        // Copy settings
        const settings = await (legacyDb as any).table('settings').toArray();
        if (settings.length > 0) {
            await targetDb.settings.bulkPut(settings);
        }

        await targetDb.close();
        legacyDb.close();

        // Register project-0 in registry
        await registryDb.projects.put({
            id: 'project-0',
            name: 'Project 1',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });

        // Delete the legacy DB
        await Dexie.delete('Database');
    } catch (err) {
        console.error('Migration from legacy database failed:', err);
        legacyDb.close();
    }
}

// ── Project CRUD ───────────────────────────────────────────────────────────

const MAX_PROJECTS = 10;

export async function createProject(): Promise<string | null> {
    const count = await registryDb.projects.count();
    if (count >= MAX_PROJECTS) return null;

    // Find next available project index
    const allProjects = await registryDb.projects.toArray();
    const existingIds = new Set(allProjects.map((p) => p.id));
    let index = 0;
    while (existingIds.has(`project-${index}`)) index++;

    const id = `project-${index}`;
    const projectNumber = count + 1;

    await registryDb.projects.add({
        id,
        name: `Project ${projectNumber}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    });

    return id;
}

export async function renameProject(id: string, name: string): Promise<void> {
    await registryDb.projects.update(id, { name: name.trim() || 'Unnamed Project', updatedAt: Date.now() });
}

export async function deleteProject(id: string): Promise<void> {
    await registryDb.projects.delete(id);
    await Dexie.delete(`gpxstudio-${id}`);
}

export async function touchProject(id: string): Promise<void> {
    await registryDb.projects.update(id, { updatedAt: Date.now() });
}

export { MAX_PROJECTS };
