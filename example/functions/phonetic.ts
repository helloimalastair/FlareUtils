import { Phonetic } from "flareutils";
import { isaac } from "./Isaac";

export const onRequestGet: PagesFunction = async () => {
  if(isaac.seeding) await isaac.seeding;
  const randProxy = () => isaac.rand(),
    generator = new Phonetic(randProxy);
  return new Response(generator.rand());
};