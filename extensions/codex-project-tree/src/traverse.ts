import { readdirSync, statSync, Stats } from 'fs';
import { resolve } from 'path';
import { LevInfo, File, Folder } from './type';
import { clone } from './utils';
import { verify, produceRules } from './ignore/index';
let levInfos: LevInfo[] = [];

/**
 * Traverses the directory structure to build a Folder/File tree.
 * @param ancestor Parent path
 * @param pathName Current entry name
 * @param level Current depth level
 * @param folder Root folder object
 * @param callback Optional per-level callback
 */
export function traverseFolder(
  ancestor: string,
  pathName: string = '',
  level: number = 0,
  folder: Folder = new Folder(),
  callback: Function = function () {}
) {
  const acPath: string = resolve(ancestor, pathName);
  if (level === 0) {
    folder = new Folder(ancestor, pathName, level);
    produceRules(acPath); // parse gitignore rules
  }
  callback(ancestor, pathName, level);
  const files: string[] = readdirSync(acPath);
  files.forEach((item: string) => {
    const curLevel = level + 1;
    const fileStat: Stats = statSync(resolve(acPath, item));
    const isDirectory: boolean = fileStat.isDirectory();
    const isBlocked: boolean = verify(acPath, item, isDirectory);
    if (isBlocked) {
      return;
    }
    if (isDirectory) {
      const childFolder: Folder = new Folder(acPath, item, curLevel);
      folder.addChild(childFolder);
      traverseFolder(acPath, item, curLevel, childFolder, callback);
    } else {
      folder.addChild(new File(acPath, item, curLevel));
      callback(acPath, item, curLevel);
    }
  });
  return folder;
}

/**
 * Traverses the constructed file tree to generate linear level information.
 * @param folder The root tree node
 * @param callback Per-node callback
 * @param pathStatus Track leaf status for branch styling
 */
export function traverse(
  folder: Folder,
  callback: Function = function () {},
  lasStatus: number[] = []
) {
  const ancestor = folder.getAncestor(),
    pathName = folder.getPathName(),
    level = folder.getLevel();
  if (folder.getLevel() === 0) {
    lasStatus = [0];
    levInfos = [
      {
        ancestor,
        pathName,
        level,
        lasStatus,
      },
    ];
  }
  callback(ancestor, pathName, level);
  const files: Array<File | Folder> = folder.getChildren();
  files.forEach((item: File | Folder, index: number) => {
    const curLevel = item.getLevel();
    lasStatus = clone(lasStatus);
    lasStatus[curLevel] = Number(index === files.length - 1);
    levInfos.push({
      ancestor: item.getAncestor(),
      pathName: item.getPathName(),
      level: curLevel,
      lasStatus,
    });
    if (item instanceof Folder) {
      traverse(<Folder>item, callback, lasStatus);
    } else {
      callback(item.getAncestor(), item.getPathName(), curLevel);
    }
  });
  if (level === 0) {
    return levInfos;
  }
}
