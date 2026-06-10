# Project rules
Never edit dist. 
Never run build. 
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

