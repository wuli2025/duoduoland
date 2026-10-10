(function (BJ) {
  // Change a group extension or one exact path here when the image task finishes.
  const config = {
    root: "assets/img/",
    extensions: { avatars: "jpg", events: "jpg", bg: "jpg", logos: "svg" },
    overrides: {},
  };
  BJ.config.assets = config;
  BJ.asset = function (group, name) {
    const key = group + "/" + name;
    return (
      config.overrides[key] ||
      config.root + key + "." + config.extensions[group]
    );
  };
})(window.BJ);
