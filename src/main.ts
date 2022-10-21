import {
  Column,
  CreateIndex,
  CreateUniqueIndex,
  Entity,
  IndexDBUtil,
  PrimaryGeneratedColumn,
} from "@/lib";

@Entity("account")
@CreateIndex("name", "name")
@CreateUniqueIndex("username", "username")
class AccountEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  username: string;
}

const util = new IndexDBUtil({
  name: "account",
  version: 1,
  entityList: [AccountEntity],
});

util.connect().then(async (db) => {
  // db.transaction("account", "readwrite").objectStore("account").index('name')
  // await util.manager.insertOne(AccountEntity, {
  //   username: "anqi00",
  //   name: "tst",
  // });
  // await util.manager.updateOne(AccountEntity, {
  //   name: "nimabi",
  //   id: 2,
  // });
  // const val = await util.manager.findOne(AccountEntity);
  // console.log(val);
  // const arr = await util.manager.find(AccountEntity, {
  //   where: {
  //     name: "anqi",
  //     id: 27,
  //   },
  // });
  // console.log(val);
  // console.log(arr);
  // await util.manager.deleteOne(AccountEntity, {
  //   where: {
  //     name: "ydy",
  //   },
  // });
});
