import { isaac } from "./Isaac";

export const onRequestGet: PagesFunction = async () => {
  if(isaac.seeding) await isaac.seeding;
  return new Response(isaac.rand().toString());
};