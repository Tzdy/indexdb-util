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

interface PrimaryGeneratedColumnOptions {
  autoIncrement?: boolean;
}

export function PrimaryGeneratedColumn(
  options?: PrimaryGeneratedColumnOptions
) {
  return function (target: Object, propKey: string) {
    const config = init(target.constructor);
    config.primary.keyPath = propKey;
    config.primary.autoIncrement = !!options?.autoIncrement;
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
        return IDBKeyRange.lowerBound(item.value, !item.equal);
      } else if (item.less) {
        return IDBKeyRange.upperBound(item.value, !item.equal);
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
      // ????????????
      return val === cursorVal;
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
    value: val,
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
    value: val,
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
  // ????????????
  where?: { [K in keyof T]?: T[K] | CompareItem | CompareItem[] };
  limit?: number;
  skip?: number;
  order?: Array<{ [K in keyof T]?: "DESC" | "ASC" }>;
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
  insert<T extends AbstractClass>(
    Entity: T,
    value: Partial<InstanceType<T>>[]
  ): Promise<IDBValidKey>;
  updateOne<T extends AbstractClass>(
    Entity: T,
    value: Partial<InstanceType<T>>,
    options?: ManagerOptions<InstanceType<T>>
  ): Promise<any>;
  update<T extends AbstractClass>(
    Entity: T,
    value: Partial<InstanceType<T>>,
    options?: ManagerOptions<InstanceType<T>>
  ): Promise<any>;
  deleteOne<T extends AbstractClass>(
    Entity: T,
    options?: ManagerOptions<InstanceType<T>>
  ): Promise<any>;
  delete<T extends AbstractClass>(
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
    // ????????????????????????????????????????????????undefined
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

    // ????????????????????????
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
          return null;
        }
      } else {
        return null;
      }
      // ??????where???????????????
      if (options && options.where && keys && keys.includes(primaryKey)) {
        const key = generateIDBRange(options.where[primaryKey]);
        if (!key) {
          return objectStore.openCursor(options.where[primaryKey]);
        } else {
          return objectStore.openCursor(key);
        }
      } else {
        return null;
      }
    }

    function findByIndex(
      objectStore: IDBObjectStore,
      config: EntityConfig,
      options?: ManagerOptions<Record<string, any>>,
      unique?: boolean
    ) {
      let keys: string[] | null = null;
      if (options && options.where) {
        keys = Object.keys(options.where);
        if (keys.length === 0) {
          return null;
        }
      } else {
        return null;
      }
      const index = filterIndex(keys, config.indexList, !!unique);
      if (index) {
        // ??????????????????
        if (index.keyPath instanceof Array) {
          const queryList = index.keyPath.map((k) => {
            // ???????????????????????????
            if (
              options &&
              options.where &&
              options.where[k] &&
              options.where[k].symbol !== symbol
            ) {
              return options.where[k];
            }
          });
          // ?????????IDBKeyRange?????????????????????keyPath???????????????????????????????????????????????????
          if (queryList.every((val) => val)) {
            return objectStore.index(index.name).openCursor(queryList);
          }
        } else {
          // ???????????????
          const queryVal = options.where[index.keyPath];
          if (queryVal && queryVal.symbol !== symbol) {
            return objectStore.index(index.name).openCursor(queryVal);
          } else if (queryVal && queryVal.symbol === symbol) {
            return objectStore
              .index(index.name)
              .openCursor(generateIDBRange(queryVal));
          }
        }
      }
      return null;
    }

    function findByUniqueIndex(
      objectStore: IDBObjectStore,
      config: EntityConfig,
      options?: ManagerOptions<Record<string, any>>
    ) {
      return findByIndex(objectStore, config, options, true);
    }

    function requestComplete(
      request: IDBRequest | IDBRequest[],
      resolve: (val: any) => void
    ) {
      if (request instanceof Array) {
        if (request.length === 0) {
          return resolve([]);
        }
        const array: any[] = [];
        let sit = 0;
        request.forEach((req, index) => {
          req.addEventListener("success", () => {
            array[index] = req.result;
            sit++;
            if (sit === request.length) {
              resolve(array);
            }
          });
          req.addEventListener("error", () => {
            array[index] = req.error;
            sit++;
            if (sit === request.length) {
              resolve(array);
            }
          });
        });
      } else {
        request.addEventListener("success", () => {
          resolve(request.result);
        });
        request.addEventListener("error", () => {
          resolve(request.error);
        });
      }
    }

    // ??????localeCompare ?????? reutrn 1 ?????? return -1 ?????? return 0
    // ??????order?????????????????????????????????
    function compare(a: any, b: any) {
      // string
      if (typeof a === "string" && typeof b === "string") {
        return a.localeCompare(b);
      } else if (
        typeof a !== undefined &&
        b !== undefined &&
        a !== null &&
        b !== null &&
        typeof a === typeof b
      ) {
        // number, Date, boolean,
        return a - b === 0 ? 0 : a - b > 0 ? 1 : -1;
      } else {
        if (typeof a !== typeof b && a) {
          return 1;
        } else if (typeof a !== typeof b && b) {
          return -1;
        } else {
          return 0;
        }
      }
    }

    function traverse(
      config: EntityConfig,
      objectStore: IDBObjectStore,
      indexRequest: IDBRequest<IDBCursorWithValue> | null,
      operate: "find" | "delete" | "update",
      value?: any,
      options?: ManagerOptions<Record<string, any>>,
      single?: boolean
    ): any {
      return new Promise((resolve, reject) => {
        const keys: string[] | null = options?.where
          ? Object.keys(options.where)
          : null;
        // ????????????where???order????????????DESC?????????????????????????????????
        let isSinglePrimaryOrder = false;
        let direction: IDBCursorDirection = "next";
        if (
          !keys &&
          options?.order?.find((i) => i[config.primary.keyPath] === "DESC")
        ) {
          direction = "prev";
          isSinglePrimaryOrder = true;
        }
        const request = indexRequest || objectStore.openCursor(null, direction);
        const limit = options?.limit;
        // ??????limit???0?????????????????????????????????0????????????
        if (Number.isInteger(limit) && limit === 0) {
          return single ? resolve(null) : resolve([]);
        }
        const skip = options?.skip;
        let skipNum = 0;
        const order = options?.order || [];
        const result: any[] = []; // single=false???????????????????????????

        request.addEventListener("success", () => {
          const cursor = request.result;
          if (cursor) {
            // ??????options && options.where???
            if (options?.where && keys) {
              // where???????????????????????????cursor
              if (!compareWith(options.where, cursor.value)) {
                return cursor.continue();
              }
            }
            // ??????????????????????????????????????????skip???
            if (skip && (order.length === 0 || isSinglePrimaryOrder)) {
              if (skipNum !== skip) {
                skipNum++;
                return cursor.continue();
              }
            }

            // ?????????????????????????????????????????????
            if (operate === "find") {
              if (single) {
                return resolve(cursor.value);
              } else {
                result.push(cursor.value);
              }
            } else if (operate === "delete") {
              if (single) {
                requestComplete(cursor.delete(), resolve);
                return;
              } else {
                requestComplete(cursor.delete(), (val) => {
                  result.push(val);
                });
              }
            } else if (operate === "update") {
              const proxy = new Proxy(value, {
                ownKeys(target) {
                  return Object.keys(target).filter(
                    (i) => i !== config.primary.keyPath
                  );
                },
              });
              const val = Object.assign(cursor.value, proxy);
              if (single) {
                requestComplete(cursor.update(val), resolve);
                return;
              } else {
                requestComplete(cursor.update(val), (val) => {
                  result.push(val);
                });
              }
            }
            // ??????single???true?????????????????????????????????????????????single
            // skip ????????????????????????limit
            // ???????????????????????????????????????limit
            if (
              limit &&
              !single &&
              (order.length === 0 || isSinglePrimaryOrder)
            ) {
              // ???????????????limit ??????cursor??????????????????????????????
              if (limit === result.length) {
                return cursor.continue(IDBDatabase.toString());
              }
            }
            cursor.continue();
          } else {
            if (single) {
              resolve(null);
            } else {
              // ??????????????????????????????????????????????????????????????????????????????????????????
              // ????????????limit???skip
              if (order.length > 0) {
                result.sort((a: any, b: any) => {
                  let swap = 0;
                  for (const item of order) {
                    const key = Object.keys(item)[0];
                    const left = a[key];
                    const right = b[key];
                    if (item[key] === "ASC") {
                      swap = compare(left, right);
                    } else {
                      swap = compare(right, left);
                    }
                    if (swap !== 0) {
                      break;
                    }
                  }
                  return swap;
                });
                return resolve(result.slice(skip, limit));
              }
              resolve(result);
            }
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
            let indexRequest: IDBRequest | null = null;
            indexRequest =
              findByPrimaryKey(objectStore, config.primary.keyPath, options) ||
              findByUniqueIndex(objectStore, config, options) ||
              findByIndex(objectStore, config, options);
            // ????????????
            const data = await traverse(
              config,
              objectStore,
              indexRequest,
              "find",
              null,
              options,
              true
            );
            return resolve(data);
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

      insert: (Entity, value) => {
        return new Promise((resolve, reject) => {
          const config = init(Entity);
          const transaction = this.db.transaction(
            config.objectStoreName,
            "readwrite"
          );
          const request = value.map((item) =>
            transaction.objectStore(config.objectStoreName).add(item)
          );
          requestComplete(request, resolve);
        });
      },

      find: (Entity, options) => {
        const config = init(Entity);
        return new Promise(async (resolve, reject) => {
          try {
            const objectStore = this.db
              .transaction(config.objectStoreName, "readonly")
              .objectStore(config.objectStoreName);
            let indexRequest: IDBRequest | null = null;
            indexRequest =
              findByPrimaryKey(objectStore, config.primary.keyPath, options) ||
              findByUniqueIndex(objectStore, config, options) ||
              findByIndex(objectStore, config, options);

            // ????????????
            const data = await traverse(
              config,
              objectStore,
              indexRequest,
              "find",
              null,
              options
            );
            return resolve(data);
          } catch (err) {
            reject(err);
          }
        });
      },

      updateOne: (Entity, value, options) => {
        return new Promise(async (resolve, reject) => {
          const config = init(Entity);
          const objectStore = this.db
            .transaction(config.objectStoreName, "readwrite")
            .objectStore(config.objectStoreName);
          let indexRequest: IDBRequest | null = null;
          indexRequest =
            findByPrimaryKey(objectStore, config.primary.keyPath, options) ||
            findByUniqueIndex(objectStore, config, options) ||
            findByIndex(objectStore, config, options);
          // ????????????
          const data = await traverse(
            config,
            objectStore,
            indexRequest,
            "update",
            value,
            options,
            true
          );
          resolve(data);
        });
      },

      update: (Entity, value, options) => {
        return new Promise(async (resolve, reject) => {
          const config = init(Entity);
          const objectStore = this.db
            .transaction(config.objectStoreName, "readwrite")
            .objectStore(config.objectStoreName);
          let indexRequest: IDBRequest | null = null;
          indexRequest =
            findByPrimaryKey(objectStore, config.primary.keyPath, options) ||
            findByUniqueIndex(objectStore, config, options) ||
            findByIndex(objectStore, config, options);
          // ????????????
          const data = await traverse(
            config,
            objectStore,
            indexRequest,
            "update",
            value,
            options
          );
          resolve(data);
        });
      },

      deleteOne: (Entity, options) => {
        return new Promise(async (resolve, reject) => {
          const config = init(Entity);
          const objectStore = this.db
            .transaction(config.objectStoreName, "readwrite")
            .objectStore(config.objectStoreName);
          let indexRequest: IDBRequest | null = null;

          indexRequest =
            findByPrimaryKey(objectStore, config.primary.keyPath, options) ||
            findByUniqueIndex(objectStore, config, options) ||
            findByIndex(objectStore, config, options);
          // ????????????
          const data = await traverse(
            config,
            objectStore,
            indexRequest,
            "delete",
            null,
            options,
            true
          );
          resolve(data);
        });
      },

      delete: (Entity, options) => {
        return new Promise(async (resolve, reject) => {
          const config = init(Entity);
          const objectStore = this.db
            .transaction(config.objectStoreName, "readwrite")
            .objectStore(config.objectStoreName);
          let indexRequest: IDBRequest | null = null;

          indexRequest =
            findByPrimaryKey(objectStore, config.primary.keyPath, options) ||
            findByUniqueIndex(objectStore, config, options) ||
            findByIndex(objectStore, config, options);
          // ????????????
          const data = await traverse(
            config,
            objectStore,
            indexRequest,
            "delete",
            null,
            options
          );
          resolve(data);
        });
      },
    };
  }

  private autoSyncIndex(transaction: IDBTransaction) {
    this.options.entityList.forEach((config) => {
      config.indexList.forEach((index) => {
        const objectStore = transaction.objectStore(config.objectStoreName);
        if (objectStore.indexNames.contains(index.name)) {
          // ??????unique???keyPath?????????????????????????????????
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
          // ??????????????????????????????????????????
          objectStore.createIndex(index.name, index.keyPath, {
            unique: index.unique,
          });
        }
      });
    });
  }

  // ?????? and ???????????? ????????????????????????????????????????????????
  // ?????????????????????????????????????????????
  private autoSyncObjectSotre(transaction: IDBTransaction) {
    this.options.entityList.forEach((config) => {
      // ?????????????????????objectStore??????
      if (!transaction.objectStoreNames.contains(config.objectStoreName)) {
        this.db.createObjectStore(config.objectStoreName, config.primary);
      }
    });
  }

  public connect() {
    return new Promise<IDBDatabase>(async (resolve, reject) => {
      const { name, version } = this.options;
      if (!Number.isInteger(version)) {
        return reject(`version ${version} ?????????????????????`);
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
          // ?????????versionChange transaction???????????????transaction?????????null?????????typescript????????????????????????????????????
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
        // ?????????????????????????????????
        request.addEventListener("success", (e) => {
          console.log("??????/?????????????????????OK");
          resolve(request.result);
        });
      } else {
        request.addEventListener("success", (e) => {
          this.db = request.result;
          console.log("??????/?????????????????????OK");
          resolve(request.result);
        });
      }
      request.addEventListener("error", (e) => {
        reject(e);
      });
    });
  }
}
