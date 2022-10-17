import { Column, CreateIndex, Entity, IndexDBUtil } from "@/lib";

@Entity("account")
@CreateIndex("name", "name")
class AccountEntity {
  @Column()
  id: number;

  @Column()
  name: string;
}

const util = new IndexDBUtil({
  name: "account",
  version: 1,
  entityList: [AccountEntity],
});

util.connect().then(async () => {
  await util.manager.insertOne(AccountEntity, {
    name: "anqi",
  });
  const val = await util.manager.findOne(AccountEntity, {
    where: {
      name: "anqi",
    },
  });
  const arr = await util.manager.find(AccountEntity, {
    where: {
      name: "anqi",
      id: 27,
    },
  });

  // console.log(val);
  console.log(arr);
});
