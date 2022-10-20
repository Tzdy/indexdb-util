import {
  Column,
  CreateIndex,
  Entity,
  IndexDBUtil,
  PrimaryGeneratedColumn,
} from "@/lib";

@Entity("account")
@CreateIndex("name", "name")
class AccountEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;
}

const util = new IndexDBUtil({
  name: "account",
  version: 1,
  entityList: [AccountEntity],
});

util.connect().then(async (db) => {
  console
    .log
    // db.transaction("account", "readwrite").objectStore("account").delete()
    ();
  // await util.manager.insertOne(AccountEntity, {
  //   name: "ydy",
  // });
  // await util.manager.updateOne(AccountEntity, {
  //   name: "nimabi",
  //   id: 2,
  // });
  // const val = await util.manager.findOne(AccountEntity, {
  //   where: {
  //     name: "anqi",
  //   },
  // });
  // const arr = await util.manager.find(AccountEntity, {
  //   where: {
  //     name: "anqi",
  //     id: 27,
  //   },
  // });
  // console.log(val);
  // console.log(arr);
});
