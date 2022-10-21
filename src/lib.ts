import "reflect-metadata";

interface EntityConfig {
  objectStoreName: string;
  column: Record<string, ColumnConfig>;
  indexList: Array<Index>;
  primary: {
    keyPath: string;
    autoIncrement: boolean;
  };
}

interface Index {
  name: string;
  unique: boolean;
  keyPath: string | string[];
}

interface ColumnConfig {
  type: Function;
  default: any;
}

interface ColumnOptions {
  default?: any;
}

type Consturctor = { new (...args: any[]): any };

function init(Ctor: Consturctor | Object): EntityConfig {
  const config = Reflect.getOwnMetadata("CONFIG", Ctor);
  if (config) {
    return config;
  } else {
    const c: EntityConfig = {
      objectStoreName: "",
      column: {},
      indexList: [],
      primary: {
        autoIncrement: true,
        keyPath: "_id",
      },
    };
    Reflect.defineMetadata("CONFIG", c, Ctor);
    return c;
  }
}

export function Entity(objectStoreName: string) {
  return function (Ctor: { new (): {} }) {
    const config = init(Ctor);
    config.objectStoreName = objectStoreName;
  };
}

export function CreateIndex(name: string, keyPath: string[] | string) {
  return function (Ctor: { new (): {} }) {
    const config = init(Ctor);
    config.indexList.push({
      name,
      keyPath,
      unique: false,
    });
  };
}

export function CreateUniqueIndex(name: string, keyPath: string[] | string) {
  return function (Ctor: { new (): {} }) {
    const config = init(Ctor);
    config.indexList.push({
      name,
      keyPath,
      unique: true,
    });
  };
}

export function Column(options?: ColumnOptions) {
  return function (target: Object, propKey: string) {
    const config = init(target.constructor);
    const type = Reflect.getMetadata("design:type", target, propKey);
    config.column[propKey] = {
      type,
      default: options?.default,
    };
  };
}

export function PrimaryGeneratedColumn() {
  return function (target: Object, propKey: string) {
    const config = init(target.constructor);
    config.primary.keyPath = propKey;
  };
}

interface ManagerOptions<T> {
  where: Partial<T> | Record<string, any>;
  limit?: number;
}

type AbstractClass = abstract new (...args: any) => any;

interface Manager {
  findOne<T extends AbstractClass>(
    Entity: T,
    options?: ManagerOptions<InstanceType<T>>
  ): Promise<T | null>;
  find<T extends AbstractClass>(
    Entity: T,
    options?: ManagerOptions<InstanceType<T>>
  ): Promise<T[] | null>;
  insertOne<T extends AbstractClass>(
    Entity: T,
    value: Partial<InstanceType<T>>
  ): Promise<IDBValidKey>;
  updateOne<T extends AbstractClass>(
    Entity: T,
    value: Partial<InstanceType<T>>
  ): Promise<any>;
  deleteOne<T extends AbstractClass>(
    Entity: T,
    options?: ManagerOptions<InstanceType<T>>
  ): Promise<any>;
}

interface IndexDBUtilOptions {
  name: string;
  version: number;
  entityList: Array<Consturctor>;
  versionChange?: (
    transaction: IDBTransaction,
    // 第一次创建数据库版本是当前版本为undefined
    currentVersion: number | undefined,
    goalVersion: number
  ) => void;
}

export class IndexDBUtil {
  private options: Omit<IndexDBUtilOptions, "entityList"> & {
    entityList: Array<EntityConfig>;
  };

  private db: IDBDatabase;

  public manager: Manager;

  constructor(op: IndexDBUtilOptions) {
    const { entityList, ...options } = op;
    this.options = {
      entityList: entityList.map((item) => Reflect.getMetadata("CONFIG", item)),
      ...options,
    };

    function findByPrimaryKey(
      objectStore: IDBObjectStore,
      where: Record<string, any>,
      primaryKey: string
    ) {
      const keys = Object.keys(where);
      return new Promise<any>((resolve, reject) => {
        // 如果where中包含主键
        if (keys.includes(primaryKey)) {
          const request = objectStore.get(where[primaryKey]);
          request.addEventListener("success", () => {
            resolve(request.result);
          });
          request.addEventListener("error", (err) => {
            reject(err);
          });
          return;
        } else {
          resolve(null);
        }
      });
    }

    function findByUniqueIndex(
      objectStore: IDBObjectStore,
      where: Record<string, any>
    ) {
      return new Promise<any>((resolve, reject) => {
        const keys = Object.keys(where);
        const uniqueIndex = keys.find((key) => objectStore.index(key).unique);
        // 如果有唯一索引
        if (uniqueIndex) {
          const request = objectStore
            .index(uniqueIndex)
            .get(where[uniqueIndex]);
          request.addEventListener("success", () => {
            resolve(request.result);
          });
          request.addEventListener("error", (err) => {
            reject(err);
          });
        } else {
          resolve(null);
        }
      });
    }

    function findByIndex(
      objectStore: IDBObjectStore,
      where: Record<string, any>
    ) {
      return new Promise<any>((resolve, reject) => {
        const keys = Object.keys(where);
        const index = keys.find((key) => objectStore.index(key));
        // 如果有索引
        if (index) {
          const request = objectStore.index(index).getAll(where[index]);
          request.addEventListener("success", () => {
            resolve(request.result);
          });
          request.addEventListener("error", (err) => {
            reject(err);
          });
        } else {
          resolve(null);
        }
      });
    }

    this.manager = {
      findOne: (Entity: any, options = { where: {} }) => {
        const config = init(Entity);
        return new Promise(async (resolve, reject) => {
          const objectStore = this.db
            .transaction(config.objectStoreName, "readonly")
            .objectStore(config.objectStoreName);
          const primaryIndexData = await findByPrimaryKey(
            objectStore,
            options.where,
            config.primary.keyPath
          );
          const keys = Object.keys(options.where);
          if (primaryIndexData) {
            return resolve(primaryIndexData);
          }

          const uniqueIndexData = await findByUniqueIndex(
            objectStore,
            options.where
          );
          if (uniqueIndexData) {
            return resolve(uniqueIndexData);
          }

          const indexDataList = await findByIndex(objectStore, options.where);
          if (indexDataList) {
            return resolve(
              indexDataList.find((i: any) => {
                return keys.every((k) => options.where[k] === i[k]);
              })
            );
          }

          // 没有索引
          const request = objectStore.openCursor();
          request.addEventListener("success", () => {
            const cursor = request.result;
            if (cursor) {
              if (
                keys.every((key) => options.where[key] === cursor.value[key])
              ) {
                return resolve(cursor.value);
              }
              cursor.continue();
            }
          });
          request.addEventListener("error", (err) => {
            reject(err);
          });
        });
      },

      insertOne: (Entity, value) => {
        return new Promise((resolve, reject) => {
          const config = init(Entity);
          const request = this.db
            .transaction(config.objectStoreName, "readwrite")
            .objectStore(config.objectStoreName)
            .add(value);
          request.addEventListener("success", () => {
            resolve(request.result);
          });
          request.addEventListener("error", (err) => reject(err));
        });
      },

      find: (Entity, options = { where: {} }) => {
        return new Promise(async (resolve, reject) => {
          const config = init(Entity);
          const objectStore = this.db
            .transaction(config.objectStoreName, "readonly")
            .objectStore(config.objectStoreName);
          const keys = Object.keys(options.where);
          const indexDataList = await findByIndex(objectStore, options.where);
          if (indexDataList) {
            return resolve(
              indexDataList.find((i: any) => {
                return keys.every((k) => options.where[k] === i[k]);
              })
            );
          }

          // 没有索引
          const request = objectStore.openCursor();
          request.addEventListener("success", () => {
            const cursor = request.result;
            if (cursor) {
              if (
                keys.every((key) => options.where[key] === cursor.value[key])
              ) {
                return resolve(cursor.value);
              }
              cursor.continue();
            }
          });
          request.addEventListener("error", (err) => {
            reject(err);
          });
        });
      },

      updateOne: (Entity, value) => {
        return new Promise((resolve, reject) => {
          const config = init(Entity);
          const request = this.db
            .transaction(config.objectStoreName, "readwrite")
            .objectStore(config.objectStoreName)
            .put(value);
          request.addEventListener("success", () => {
            resolve(request.result);
          });
          request.addEventListener("error", (err) => reject(err));
        });
      },

      deleteOne: (Entity, options = { where: {} }) => {
        return new Promise(async (resolve, reject) => {
          const config = init(Entity);
          const objectStore = this.db
            .transaction(config.objectStoreName, "readwrite")
            .objectStore(config.objectStoreName);

          const keys = Object.keys(options.where);
          const indexDataList = await findByIndex(objectStore, options.where);
          if (indexDataList) {
            const data = indexDataList.find((i: any) => {
              return keys.every((k) => options.where[k] === i[k]);
            });
            if (data) {
              objectStore
                .delete(data[config.primary.keyPath])
                .addEventListener("success", () => {
                  resolve(data);
                });
              return;
            }
          }

          // 没有索引
          const request = objectStore.openCursor();
          request.addEventListener("success", () => {
            const cursor = request.result;
            if (cursor) {
              if (
                keys.every((key) => options.where[key] === cursor.value[key])
              ) {
                objectStore
                  .delete(cursor.value[config.primary.keyPath])
                  .addEventListener("success", () => {
                    resolve(cursor.value);
                  });
                return;
              }
              cursor.continue();
            }
          });
          request.addEventListener("error", (err) => {
            reject(err);
          });
        });
      },
    };
  }

  private autoSyncIndex(transaction: IDBTransaction) {
    this.options.entityList.forEach((config) => {
      config.indexList.forEach((index) => {
        const objectStore = transaction.objectStore(config.objectStoreName);
        if (objectStore.indexNames.contains(index.name)) {
          // 如果unique或keyPath不一样就删除后重建索引
          if (
            objectStore.index(index.name).unique !== index.unique ||
            JSON.stringify(objectStore.index(index.name).keyPath) !==
              JSON.stringify(index.keyPath)
          ) {
            objectStore.deleteIndex(index.name);
            objectStore.createIndex(index.name, index.keyPath, {
              unique: index.unique,
            });
          }
        } else {
          // 如果没有对应索引名就直接创建
          objectStore.createIndex(index.name, index.keyPath, {
            unique: index.unique,
          });
        }
      });
    });
  }

  // 创建 and 添加索引 ，没有才会添加，（保证正常运行）
  // 删除，迁移数据，不会自动同步。
  private autoSyncObjectSotre(transaction: IDBTransaction) {
    this.options.entityList.forEach((config) => {
      // 如果不存在对应objectStore添加
      if (!transaction.objectStoreNames.contains(config.objectStoreName)) {
        this.db.createObjectStore(config.objectStoreName, config.primary);
      }
    });
  }

  public connect() {
    return new Promise<IDBDatabase>(async (resolve, reject) => {
      const { name, version } = this.options;
      if (!Number.isInteger(version)) {
        return reject(`version ${version} 必须是一个整数`);
      }

      const dbs = await indexedDB.databases();
      const dbInfo = dbs.find((item) => item.name === name) || {};
      const isUpgrade = !dbs.find(
        (item) => item.name === name && item.version === version
      );
      const currentVersion = dbInfo.version;
      const request = indexedDB.open(name, version);
      if (isUpgrade) {
        request.addEventListener("upgradeneeded", (e) => {
          this.db = request.result;
          // 因为当versionChange transaction结束后这个transaction会变为null，但是typescript不属于运行时，所以猜不到
          if (request.transaction) {
            this.autoSyncObjectSotre(request.transaction);
            this.autoSyncIndex(request.transaction);
            this.options.versionChange &&
              this.options.versionChange(
                request.transaction,
                currentVersion,
                version
              );
          }
        });
        // 监听是否成功打开数据库
        request.addEventListener("success", (e) => {
          console.log("创建/打开一个数据库OK");
          resolve(request.result);
        });
      } else {
        request.addEventListener("success", (e) => {
          this.db = request.result;
          console.log("创建/打开一个数据库OK");
          resolve(request.result);
        });
      }
      request.addEventListener("error", (e) => {
        reject(e);
      });
    });
  }
}
