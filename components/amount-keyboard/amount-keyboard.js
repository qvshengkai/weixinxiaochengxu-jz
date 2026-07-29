Component({
  methods: {
    onTap(e) {
      const key = e.currentTarget.dataset.k;
      this.triggerEvent('key', { key });
    }
  }
});
