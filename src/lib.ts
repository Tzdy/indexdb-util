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

const symbol = Symbol();

interface CompareItem {
  symbol: Symbol;
  value: any;
  equal: boolean;
  more: boolean;
  less: boolean;
}

function generateIDBRange(item: CompareItem | CompareItem[] | null) {
  if (!item) {
    return null;
  }
  if (item instanceof Array) {
    if (item[0] && item[0].symbol === symbol) {
      const idbRange = IDBKeyRange.bound(
        item[0].value,
        item[1].value,
        !item[0].equal,
        !item[1].equal
      );
      return idbRange;
    }
  } else {
    if (item.symbol === symbol) {
      if (item.more) {
        return IDBKeyRange.upperBound(item.value, !item.equal);
      } else if (item.less) {
        return IDBKeyRange.lowerBound(item.value, !item.equal);
      }
    }
  }
  return null;
}

function isCompareItem(item: any): item is CompareItem {
  if (item.symbol === symbol) {
    return true;
  } else {
    return false;
  }
}

type allowWhereType =
  | CompareItem
  | CompareItem[]
  | string
  | boolean
  | number
  | Date;
function compareWith(where: Record<string, allowWhereType>, cursorObject: any) {
  return Object.keys(where).every((key) => {
    const val = where[key];
    const cursorVal = cursorObject[key];
    if (val instanceof Array) {
      // between
      if (val.every((item) => isCompareItem(item))) {
        const left = val[0];
        const right = val[1];
        // x >= left && x <= right
        if (left.equal && right.equal) {
          if (cursorVal >= left.value && cursorVal <= right.value) {
            return true;
          }
        } else if (left.equal) {
          if (cursorVal >= left.value && cursorVal < right.value) {
            return true;
          }
        } else if (right.equal) {
          if (cursorVal > left.value && cursorVal <= right.value) {
            return true;
          }
        } else {
          if (cursorVal > left.value && cursorVal < right.value) {
            return true;
          }
        }
        return false;
      }
    } else if (isCompareItem(val)) {
      if (val.more && val.equal) {
        if (cursorVal >= val.value) {
          return true;
        }
      } else if (val.less && val.equal) {
        if (cursorVal <= val.value) {
          return true;
        }
      } else if (val.more) {
        if (cursorVal > val.value) {
          return true;
        }
      } else if (val.less) {
        if (cursorVal < val.value) {
          return true;
        }
      } else if (val.equal) {
        if (cursorVal === val.value) {
          return true;
        }
      }
      return false;
    } else {
    }
  });
}

export function LessThen(val: any) {
  if (val && val.symbol === symbol) {
    val.less = true;
    return val;
  }
  return {
    symbol,
    value: !!val,
    equal: false,
    more: false,
    less: true,
  };
}

export function Equal(val: any) {
  return {
    symbol,
    value: val,
    equal: true,
    more: false,
    less: false,
  };
}

export function MoreThen(val: any) {
  if (val && val.symbol === symbol) {
    val.more = true;
    return val;
  }
  return {
    symbol,
    value: !!val,
    equal: false,
    more: true,
    less: false,
  };
}

export function Between(
  left: any,
  right: any,
  leftOpen: boolean,
  rightOpen: boolean
) {
  return [
    { symbol, value: left, more: true, less: false, equal: !leftOpen },
    { symbol, value: right, more: false, less: true, equal: !rightOpen },
  ];
}

interface ManagerOptions<T> {
  // 类型推断
  where?: { [K in keyof T]?: T[K] | CompareItem | CompareItem[] };
  index?: string;
  limit?: number;
}

type AbstractClass = abstract new (...args: any) => any;

interface Manager {
  findOne<T extends AbstractClass>(
    Entity: T,
    options?: ManagerOptions<InstanceType<T>>
  ): Promise<InstanceType<T> | null>;
  find<T extends AbstractClass>(
    Entity: T,
    options?: ManagerOptions<InstanceType<T>>
  ): Promise<Array<InstanceType<T>>>;
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

    // 取一个命中的索引
    function filterIndex(
      keys: string[],
      indexList: Index[],
      unique: boolean = false
    ) {
      for (let index of indexList) {
        if (unique) {
          if (!index.unique) {
            continue;
          }
        }
        if (index.keyPath instanceof Array) {
          if (index.keyPath.every((k) => keys.includes(k))) {
            return index;
          }
        } else {
          if (keys.includes(index.keyPath)) {
            return index;
          }
        }
      }
    }

    function findByPrimaryKey(
      objectStore: IDBObjectStore,
      primaryKey: string,
      options?: ManagerOptions<Record<string, any>>
    ) {
      let keys: string[] | null = null;
      if (options && options.where) {
        keys = Object.keys(options.where);
        if (keys.length === 0) {
          return Promise.resolve(null);
        }
      } else {
        return Promise.resolve(null);
      }
      return new Promise<any>((resolve, reject) => {
        let request: IDBRequest | null = null;
        // 如果where中包含主键
        if (options && options.where && keys && keys.includes(primaryKey)) {
          const key = generateIDBRange(options.where[primaryKey]);

          if (!key) {
            request = objectStore.get(options.where[primaryKey]);
          } else {
            request = objectStore.getAll(key);
          }
        } else {
          return resolve(null);
        }
        request.addEventListener("success", () => {
          resolve(request && request.result);
        });
        request.addEventListener("error", (err) => {
          reject(err);
        });
      });
    }

    function findByIndex(
      objectStore: IDBObjectStore,
      config: EntityConfig,
      options?: ManagerOptions<Record<string, any>>,
      unique?: boolean
    ) {
      let keys: string[] | null = null;
      return new Promise<any>((resolve, reject) => {
        if (options && options.where) {
          keys = Object.keys(options.where);
          if (keys.length === 0) {
            return resolve(null);
          }
        } else {
          return resolve(null);
        }
        const index = filterIndex(keys, config.indexList, !!unique);
        let request: IDBRequest | null = null;
        if (index) {
          // 联合唯一索引
          if (index.keyPath instanceof Array) {
            const queryList = index.keyPath.map((k) => {
              // 是确切值不是范围值
              if (
                options &&
                options.where &&
                options.where[k] &&
                options.where[k].symbol !== symbol
              ) {
                return options.where[k];
              }
            });
            // 在没有IDBKeyRange的情况下，并且keyPath数组中所有项都命中才能触发联合索引
            if (queryList.every((val) => val)) {
              request = objectStore.index(index.name).getAll(queryList);
            }
          } else {
            // 单唯一索引
            const queryVal = options.where[index.keyPath];
            if (queryVal && queryVal.symbol !== symbol) {
              request = objectStore.index(index.name).getAll(queryVal);
            } else if (queryVal && queryVal.symbol === symbol) {
              request = objectStore
                .index(index.name)
                .getAll(generateIDBRange(queryVal));
            }
          }
        } else {
          return resolve(null);
        }
        if (!request) {
          return resolve(null);
        }
        request.addEventListener("success", () => {
          resolve(request && request.result);
        });
        request.addEventListener("error", (err) => {
          reject(err);
        });
      });
    }

    function findByUniqueIndex(
      objectStore: IDBObjectStore,
      config: EntityConfig,
      options?: ManagerOptions<Record<string, any>>
    ) {
      return findByIndex(objectStore, config, options, true);
    }

    function findByNotIndex(
      objectStore: IDBObjectStore,
      config: EntityConfig,
      options?: ManagerOptions<Record<string, any>>,
      single?: boolean
    ): any {
      return new Promise((resolve, reject) => {
        const request = objectStore.openCursor();
        const keys: string[] | null = options?.where
          ? Object.keys(options.where)
          : null;
        const result: any = []; // single=false时用来保存多条结果
        request.addEventListener("success", () => {
          const cursor = request.result;
          if (cursor) {
            if (keys) {
              // where中的每一项都满足
              if (
                keys.every(
                  (key) =>
                    options?.where && options.where[key] === cursor.value[key]
                )
              ) {
                // 如果只需要查询一条，就可以返回
                if (single) {
                  return resolve(cursor.value);
                } else {
                  result.push(cursor.value);
                }
              }
            }
            cursor.continue();
          } else {
            resolve(result);
          }
        });
        request.addEventListener("error", (err) => {
          reject(err);
        });
      });
    }

    this.manager = {
      findOne: (Entity: any, options) => {
        const config = init(Entity);
        return new Promise(async (resolve, reject) => {
          try {
            const objectStore = this.db
              .transaction(config.objectStoreName, "readonly")
              .objectStore(config.objectStoreName);
            const primaryIndexData = await findByPrimaryKey(
              objectStore,
              config.primary.keyPath,
              options
            );
            if (primaryIndexData) {
              return resolve(primaryIndexData[0]);
            }

            const uniqueIndexData = await findByUniqueIndex(
              objectStore,
              config,
              options
            );
            if (uniqueIndexData) {
              return resolve(uniqueIndexData[0]);
            }

            const indexData = await findByIndex(objectStore, config, options);
            if (indexData) {
              return resolve(indexData[0]);
            }

            // 没有索引
            const data = await findByNotIndex(
              objectStore,
              config,
              options,
              true
            );
            if (data) {
              return resolve(data);
            }
          } catch (err) {
            reject(err);
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

      find: (Entity, options) => {
        const config = init(Entity);
        return new Promise(async (resolve, reject) => {
          try {
            const objectStore = this.db
              .transaction(config.objectStoreName, "readonly")
              .objectStore(config.objectStoreName);
            const primaryIndexData = await findByPrimaryKey(
              objectStore,
              config.primary.keyPath,
              options
            );
            if (primaryIndexData) {
              return resolve(primaryIndexData);
            }

            const uniqueIndexData = await findByUniqueIndex(
              objectStore,
              config,
              options
            );
            if (uniqueIndexData) {
              return resolve(uniqueIndexData);
            }

            const indexData = await findByIndex(objectStore, config, options);
            if (indexData) {
              return resolve(indexData);
            }

            // 没有索引
            const data = await findByNotIndex(objectStore, config, options);
            if (data) {
              return resolve(data);
            }
          } catch (err) {
            reject(err);
          }
        });
      },

      // updateOne: (Entity, value) => {
      //   return new Promise((resolve, reject) => {
      //     const config = init(Entity);
      //     const request = this.db
      //       .transaction(config.objectStoreName, "readwrite")
      //       .objectStore(config.objectStoreName)
      //       .put(value);
      //     request.addEventListener("success", () => {
      //       resolve(request.result);
      //     });
      //     request.addEventListener("error", (err) => reject(err));
      //   });
      // },

      // deleteOne: (Entity, options = { where: {} }) => {
      //   return new Promise(async (resolve, reject) => {
      //     const config = init(Entity);
      //     const objectStore = this.db
      //       .transaction(config.objectStoreName, "readwrite")
      //       .objectStore(config.objectStoreName);

      //     const keys = Object.keys(options.where);
      //     const indexDataList = await findByIndex(objectStore, options.where);
      //     if (indexDataList) {
      //       const data = indexDataList.find((i: any) => {
      //         return keys.every((k) => options.where[k] === i[k]);
      //       });
      //       if (data) {
      //         objectStore
      //           .delete(data[config.primary.keyPath])
      //           .addEventListener("success", () => {
      //             resolve(data);
      //           });
      //         return;
      //       }
      //     }

      //     // 没有索引
      //     const request = objectStore.openCursor();
      //     request.addEventListener("success", () => {
      //       const cursor = request.result;
      //       if (cursor) {
      //         if (
      //           keys.every((key) => options.where[key] === cursor.value[key])
      //         ) {
      //           objectStore
      //             .delete(cursor.value[config.primary.keyPath])
      //             .addEventListener("success", () => {
      //               resolve(cursor.value);
      //             });
      //           return;
      //         }
      //         cursor.continue();
      //       }
      //     });
      //     request.addEventListener("error", (err) => {
      //       reject(err);
      //     });
      //   });
      // },
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
