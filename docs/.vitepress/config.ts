import { defineConfig } from "vitepress";
import { readdirSync, statSync, writeFileSync } from "fs";

const getAllFiles = (dirPath: string) => {
	const data: string[] = [];
	readdirSync(dirPath).forEach((file) => {
		if (statSync(`${dirPath}/${file}`).isDirectory()) {
			data.push(...getAllFiles(`${dirPath}/${file}`));
		} else if (file.endsWith(".html") && !file.startsWith("404")) {
			data.push(
				`https://flareutils.pages.dev/${dirPath.replace(
					"temp/docs",
					"",
				)}/${file.replace(/(index\.html)|(\.html)/g, "")}/`.replaceAll(
					/\/{2,}/g,
					"/",
				),
			);
		}
	});
	return data;
};

export default defineConfig({
	title: "Flareutils",
	lang: "en-US",
	description:
		"Small Utilities and little goodies that make developing with Cloudflare easier and faster.",
	cleanUrls: true,
	cacheDir: "../temp/cache",
	outDir: "../temp/docs",
	ignoreDeadLinks: true,
	buildEnd() {
		writeFileSync(
			"temp/docs/sitemap.xml",
			`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${getAllFiles(
				"temp/docs",
			)
				.map((e) => `<url><loc>${e}</loc></url>`)
				.join("")}</urlset>`,
		);
	},
	themeConfig: {
		algolia: {
			appId: "XA1O8DZHW5",
			apiKey: "671076a2197d38a9d19a35c2db13b803",
			indexName: "flareutils",
		},
		outline: "deep",
		footer: {
			message: "Released under the MIT License.",
			copyright: `Copyright © ${new Date().getFullYear()}-present Alastair Rosewood`,
		},
		socialLinks: [
			{ icon: "github", link: "https://github.com/helloimalastair/flareutils" },
		],
		sidebar: [
			{
				text: "General",
				items: [
					{ text: "What is it?", link: "/what-is-it" },
					{ text: "License", link: "/license" },
				],
			},
			{
				text: "Utilities",
				items: [
					{ text: "BetterKV", link: "/betterkv/" },
					{ text: "Isaac", link: "/isaac/" },
					{ text: "MailChannels", link: "/mailchannels/" },
					{ text: "PromiseQueue", link: "/promisequeue/" },
					{ text: "Phonetic", link: "/phonetic/" },
					{ text: "Stubby", link: "/stubby/" },
					{ text: "Temra", link: "/temra/" },
					{ text: "Resizer", link: "/resizer/" },
				],
			},
		],
	},
});
