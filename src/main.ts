import { IndexDBUtil } from "@/lib";
import { Account } from "./Account";
import { AccountDetailType } from "./AccountDetailType";

const util = new IndexDBUtil({
  name: "account",
  version: 1,
  entityList: [Account, AccountDetailType],
});

util.connect().then(async (db) => {
  const list = await util.manager.find(Account);
  list.forEach((i) => {
    i.account_number;
  });
});
