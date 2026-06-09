<script>
  export let tabs = [];
  export let activeTab = void 0;
  export let sharedProps = {};

  $: activeComponent = tabs.find((tab) => tab.id === activeTab)?.component;
</script>

<template lang="pug">
  .tabs(class="{$$restProps.class}")
    .tabs-list
      +each("tabs as tab")
        button(type="button" class="{activeTab === tab.id ? 'active' : ''}" on:click!="{() => (activeTab = tab.id)}")
          | {tab.label}

    .tab-content
      +if("activeComponent")
        svelte:component(this="{activeComponent}" sharedProps="{sharedProps}")
</template>

<style lang="scss">
  @import "../../styles/Mixins.sass";

  .tabs {
    @include flex-column;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    width: 100%;
    padding: 0.5rem 0 0 0;

    &.gas-tabs {
      border: none;
    }

    .tabs-list {
      @include flex-row;
      @include flex-space-evenly;
      @include panel-1;
      list-style: none;
      width: 100%;
      margin: 0.5rem 0 0 0;
      height: 100%;
      flex: 0;

      button {
        --gas-button-border-radius: 5px;
        --button-line-height: var(--tab-line-height);
        --button-font-size: var(--tab-font-size);
        @include button;
        position: relative;
        overflow: hidden;
        width: 100%;
        height: 200%;
        margin: -10px 2px;
        font-weight: normal;
        font-size: larger;
        margin-bottom: -10px;
        padding: 11px 0;
        align-items: start;
        color: var(--gas-color-text, #000);

        &:not(:first-child) {
          border-left: none;
        }

        &:not(.active) {
          &:before {
            content: "";
            border-top: 2px solid var(--tab-inactive-border, rgb(60, 60, 60));
            position: absolute;
            width: 100%;
            bottom: 5px;
          }

          &:hover {
            &:before {
              content: "";
              border-top: 5px solid var(--color-border-highlight);
              position: absolute;
              width: 100%;
              bottom: 5px;
            }
          }
        }

        &.active {
          &:before {
            content: "";
            border-top: 5px solid var(--tab-active-indicator, brown);
            position: absolute;
            width: 100%;
            bottom: 5px;
          }

          &:hover {
            background: var(--tab-active-hover-background, #efe7d6);
            color: var(--tab-active-hover-color, var(--tab-active-color, var(--dnd5e-color-gold, #b59e54)));
          }

          font-weight: bold;
          background: var(--tab-active-background, #f9f9f9);
          color: var(--tab-active-color, var(--dnd5e-color-gold, #b59e54));
        }
      }
    }
  }

  .tab-content {
    @include inset;
    @include flex-column;
    flex: 1;
    min-height: 0;
    width: 100%;
    position: relative;
    overflow-x: hidden;
    overflow-y: auto;
  }
</style>
