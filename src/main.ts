import { IndexDBUtil } from "@/lib";

class A {
  a: number;
}

const util = new IndexDBUtil({
  name: "account",
  version: 1,
  entityList: [A],
});

util.connect().then(async (db) => {
  const list = await util.manager.find(A, {
    where: {
      a: 1,
    },
  });
});
