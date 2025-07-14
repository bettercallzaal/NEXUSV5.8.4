import fs from 'fs';
import path from 'path';

// Define types locally to avoid import issues in admin scripts
interface Link {
  id: string;
  title: string;
  url: string;
  description: string;
  tags?: string[];
  isNew?: boolean;
  isOfficial?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface Subcategory {
  name: string;
  links: Link[];
}

interface Category {
  name: string;
  subcategories: Subcategory[];
}

interface LinksData {
  categories: Category[];
}

/**
 * Load links data from the specified dataset
 * @param dataset Name of the dataset to load (default: 'default')
 * @returns Promise resolving to the links data
 */
export async function loadLinksData(dataset: string = 'default'): Promise<LinksData> {
  const dataPath = getDataPath(dataset);
  
  try {
    if (!fs.existsSync(dataPath)) {
      console.warn(`Data file not found: ${dataPath}`);
      return { categories: [] };
    }
    
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    return data;
  } catch (err) {
    console.error(`Error loading links data from ${dataPath}:`);
    console.error(err);
    return { categories: [] };
  }
}

/**
 * Save links data to the specified dataset
 * @param data Links data to save
 * @param dataset Name of the dataset to save to (default: 'default')
 */
export async function saveLinksData(data: LinksData, dataset: string = 'default'): Promise<void> {
  const dataPath = getDataPath(dataset);
  
  try {
    // Ensure the directory exists
    const dir = path.dirname(dataPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    console.log(`Links data saved to ${dataPath}`);
  } catch (err) {
    console.error(`Error saving links data to ${dataPath}:`);
    console.error(err);
    throw err;
  }
}

/**
 * Create a backup of the links data
 * @param dataset Name of the dataset to backup (default: 'default')
 * @returns Path to the backup file
 */
export async function backupLinksData(dataset: string = 'default'): Promise<string> {
  const dataPath = getDataPath(dataset);
  
  try {
    if (!fs.existsSync(dataPath)) {
      throw new Error(`Data file not found: ${dataPath}`);
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${dataPath}.${timestamp}.backup`;
    
    fs.copyFileSync(dataPath, backupPath);
    console.log(`Backup created at ${backupPath}`);
    
    return backupPath;
  } catch (err) {
    console.error(`Error backing up links data from ${dataPath}:`);
    console.error(err);
    throw err;
  }
}

/**
 * Get the path to the links data file for the specified dataset
 * @param dataset Name of the dataset
 * @returns Path to the links data file
 */
function getDataPath(dataset: string): string {
  const baseDir = process.cwd();
  
  if (dataset === 'default') {
    return path.join(baseDir, 'src/data/links-data.json');
  }
  
  return path.join(baseDir, `src/data/links-data-${dataset}.json`);
}
