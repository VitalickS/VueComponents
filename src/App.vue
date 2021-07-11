<template>
  <div id="app">
    <v-app>
      <g-data-grid
        :items="items"
        track-id="filename"
        table-id="tbl1"
        :height="700"
        :calcRowHeight="(r, exp) => (exp ? 200 : 25)"
        multiple-selection
        :loading="loading"
      >
        <template v-slot:details="{ item }">
          <code>{{ item }}</code>
        </template>
        <template v-slot:cell.title="{ item, toggleExpand, expanded }">
          <v-icon
            x-small
            class="mb-1"
            @click="toggleExpand(item)"
            :color="expanded ? 'info' : undefined"
          >
            {{ expanded ? "mdi-chevron-up" : "mdi-chevron-down" }}
          </v-icon>
          {{ item.title }}
        </template>
      </g-data-grid>
    </v-app>
  </div>
</template>

<script src="./App.ts">
</script>

<style lang="scss">
</style>
