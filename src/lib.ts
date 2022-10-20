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
  where?: Partial<T>;
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
    value: Partial<InstanceType<T>>,
    key?: string
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

    function getIndex<T extends AbstractClass>(
      Entity: AbstractClass,
      options?: ManagerOptions<InstanceType<T>> | undefined
    ) {
      let directIndex: Index | null = null; // 直接索引，一次就能查出来。
      const indirectIndexList: Array<Index> = []; // 间接索引，查询多次。
      const config = init(Entity);
      if (options?.where) {
        const keys = Object.keys(options.where);
        if (keys.length > 0) {
          for (const i of config.indexList) {
            if (i.keyPath instanceof Array) {
              if (keys.every((k) => i.keyPath.includes(k))) {
                directIndex = i;
                break;
              }
            } else {
              if (keys.includes(i.keyPath)) {
                indirectIndexList.push(i);
              }
            }
          }
        }
      }
      return {
        directIndex,
        indirectIndexList,
      };
    }

    this.manager = {
      findOne: (Entity, options) => {
        const config = init(Entity);
        const { directIndex, indirectIndexList } = getIndex(Entity, options);
        return new Promise((resolve, reject) => {
          const objectStore = this.db
            .transaction(config.objectStoreName, "readonly")
            .objectStore(config.objectStoreName);
          if (
            directIndex &&
            options?.where &&
            directIndex.keyPath instanceof Array
          ) {
            const query = Object.values(options.where);
            const keys = Object.keys(options.where);
            for (let i = 0; i < query.length; i++) {
              const idx = keys.findIndex(
                (k) => k === (directIndex as Index).keyPath[i]
              );
              if (idx !== i) {
                const bak = query[i];
                query[i] = query[idx];
                query[idx] = bak;
              }
            }
            const request = objectStore.index(directIndex.name).get(query);
            request.addEventListener("success", () => {
              resolve(request.result);
            });
            request.addEventListener("error", (err) => {
              reject(err);
            });
          } else if (indirectIndexList.length > 0 && options?.where) {
            const request = objectStore
              .index(indirectIndexList[0].name)
              .getAll(options?.where[indirectIndexList[0].keyPath as string]);
            request.addEventListener("success", () => {
              request.result.forEach((item) => {
                // where中的字段和item中对应的字段对比
                if (
                  options.where &&
                  JSON.stringify(
                    Object.keys(options.where).reduce((a, b) => {
                      Reflect.set(a, b, item[b]);
                      return a;
                    }, {})
                  ) === JSON.stringify(options.where)
                ) {
                  return resolve(item);
                }
              });
              return resolve(null);
            });
            request.addEventListener("error", (err) => {
              reject(err);
            });
          } else {
            const request = objectStore.getAll(null, 1);
            request.addEventListener("success", () => {
              resolve(request.result[0]);
            });
            request.addEventListener("error", (err) => {
              reject(err);
            });
          }
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

      find: (Entity, options?) => {
        return new Promise((resolve, reject) => {
          const config = init(Entity);
          const { directIndex, indirectIndexList } = getIndex(Entity, options);
          const objectStore = this.db
            .transaction(config.objectStoreName, "readonly")
            .objectStore(config.objectStoreName);
          if (
            directIndex &&
            options?.where &&
            directIndex.keyPath instanceof Array
          ) {
            const query = Object.values(options.where);
            const keys = Object.keys(options.where);
            for (let i = 0; i < query.length; i++) {
              const idx = keys.findIndex(
                (k) => k === (directIndex as Index).keyPath[i]
              );
              if (idx !== i) {
                const bak = query[i];
                query[i] = query[idx];
                query[idx] = bak;
              }
            }
            const request = objectStore.index(directIndex.name).getAll(query);
            request.addEventListener("success", () => {
              resolve(request.result);
            });
            request.addEventListener("error", (err) => {
              reject(err);
            });
          } else if (indirectIndexList.length > 0 && options?.where) {
            const request = objectStore
              .index(indirectIndexList[0].name)
              .getAll(options?.where[indirectIndexList[0].keyPath as string]);
            request.addEventListener("success", () => {
              resolve(
                request.result.filter((item) => {
                  // where中的字段和item中对应的字段对比
                  if (
                    options.where &&
                    JSON.stringify(
                      Object.keys(options.where).reduce((a, b) => {
                        Reflect.set(a, b, item[b]);
                        return a;
                      }, {})
                    ) === JSON.stringify(options.where)
                  ) {
                    return true;
                  }
                })
              );
            });
            request.addEventListener("error", (err) => {
              reject(err);
            });
          } else {
            const request = this.db
              .transaction(config.objectStoreName, "readonly")
              .objectStore(config.objectStoreName)
              .getAll();
            request.addEventListener("success", () => {
              resolve(request.result);
            });
            request.addEventListener("error", (err) => reject(err));
          }
        });
      },

      updateOne: (Entity, value, key) => {
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
