
import * as fs from "fs";
import * as path from "path";

export namespace EnhancedResolve {
	export interface Module {
		request: string;
		path: string;
		query: string;
		directory: boolean;
	}
	export interface Resolver{
		plugin(name: "module", handler: (obj: Module, callback: () => void) => void): void;
	}
}
export class WebuilderResolver{
	public static commonFiles = {};
	public static apply(resolver: EnhancedResolve.Resolver){
		resolver.plugin("module", function(module, callback) {
			let PackageName = module.request;
			const splash = PackageName.indexOf("/");
			if (splash >= 0){
				PackageName = PackageName.substr(0, splash);
			}
			const packageURL = WebuilderResolver.lookingForPackage(PackageName, module.path);
			if (packageURL !== null){
				const newModule: EnhancedResolve.Module = {
					directory: false,
					path: module.path,
					query: module.query,
					request: module.request,
				};
				if (splash < 0){
					const data = fs.readFileSync(packageURL + "/package.json").toString();
					const PackageFile = JSON.parse(data);
					if (PackageFile && PackageFile.hasOwnProperty("main")){
						newModule.request = path.resolve(packageURL, PackageFile.main);
					}else{
						newModule.request = path.resolve(packageURL, "index.js");
					}
				}else{
					newModule.request = path.resolve(packageURL, module.request.substr(splash + 1));
				}
				const lastSplash = newModule.request.lastIndexOf("/");
				if (lastSplash >= 0){
					const filename = newModule.request.substr(lastSplash + 1);
					const formats = ["ts", "js", "less", "css"];
					const dot = filename.lastIndexOf(".");
					const ext = dot !== -1 ? filename.substr(dot) : "";
					if (formats.indexOf(ext) === -1){
						for (const format of formats){
							if (fs.existsSync(newModule.request + "." + format)){
								newModule.request += "." + format;
								break;
							}
						}
					}
				}
				fs.exists(newModule.request, (exists) => {
					if (exists){
						const regex = /\/packages\/([^\/]+)\//;
						const matches = regex.exec(newModule.path);
						if (matches){
							if (!WebuilderResolver.commonFiles.hasOwnProperty(newModule.request)){
								WebuilderResolver.commonFiles[newModule.request] = [];
							}
							if (WebuilderResolver.commonFiles[newModule.request].indexOf(matches[1]) < 0){
								WebuilderResolver.commonFiles[newModule.request].push(matches[1]);
							}
						}
						newModule.path = path.dirname(newModule.request);
						this.doResolve("resolve", newModule, "resolve " + newModule.request + " in " + newModule.path, callback);
					}else{
						callback();
					}
				});
			}else{
				callback();
			}
		});
	}
	private static cachePackages = {};
	private static lookingForPackage(name: string, basepath: string): string{
		if (WebuilderResolver.cachePackages.hasOwnProperty(name)){
			return WebuilderResolver.cachePackages[name];
		}
		let dir = basepath;
		while (dir !== "/"){
			if (
				fs.existsSync(`${dir}/node_modules/${name}/package.json`) &&
				fs.lstatSync(`${dir}/node_modules/${name}/package.json`).isFile()
			){
				WebuilderResolver.cachePackages[name] = `${dir}/node_modules/${name}`;
				return `${dir}/node_modules/${name}`;
			}
			dir = path.dirname(dir);
		}
		return null;
	}
}
export function IsCommonModule(module: any){
	const userRequest = module.userRequest;
	if (typeof userRequest !== "string") {
		return false;
	}
	let found = false;
	let exts = [".ts", ".js"];

	exts = exts.sort();
	for (let i = 0; i < exts.length && !found; i++){
		if (userRequest.substr(-exts[i].length) === exts[i]){
			found = true;
		}
	}
	if (
		found &&
		WebuilderResolver.commonFiles.hasOwnProperty(userRequest) &&
		WebuilderResolver.commonFiles[userRequest].length > 1
	){
		return true;
	}
	return false;
}
