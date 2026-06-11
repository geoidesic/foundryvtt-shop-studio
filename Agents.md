# Project rules
Never edit dist. 
Never run build. 
Never manually copy dist/ output to the Foundry Data modules folder — HMR + symlinks handle propagation automatically.
Always lint errors.

# Javascript rules
Always use ESM import
Never use require

# Development
Never use `npm`. Always use `bun` instead.
```bash
bun dev           # Never use build commands - HMR handles compilation
nvm use 24        # If node issues occur
```
This is a foundryvtt module and as such conforms to the FoundryVTT API spec, so reference it when writing game logichttps://foundryvtt.wiki/en/development/api
