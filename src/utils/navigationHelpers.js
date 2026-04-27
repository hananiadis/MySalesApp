export function canNavigateTo(navigation, routeName) {
  const routeNames = navigation?.getState?.()?.routeNames;
  return Array.isArray(routeNames) && routeNames.includes(routeName);
}

export function navigateToAncestorRoute(navigation, routeName, params) {
  if (!navigation) {
    return false;
  }

  const chain = [];
  let current = navigation;

  while (current) {
    chain.push(current);
    current = current.getParent?.();
  }

  const targetNavigator = [...chain].reverse().find((navigatorRef) => {
    return typeof navigatorRef?.navigate === 'function' && canNavigateTo(navigatorRef, routeName);
  });

  if (targetNavigator) {
    if (typeof params === 'undefined') {
      targetNavigator.navigate(routeName);
    } else {
      targetNavigator.navigate(routeName, params);
    }
    return true;
  }

  const fallbackNavigator = chain.find((navigatorRef) => typeof navigatorRef?.navigate === 'function');
  if (fallbackNavigator) {
    if (typeof params === 'undefined') {
      fallbackNavigator.navigate(routeName);
    } else {
      fallbackNavigator.navigate(routeName, params);
    }
    return true;
  }

  return false;
}

export function navigateToMainHome(navigation) {
  return (
    navigateToAncestorRoute(navigation, 'MainHome') ||
    navigateToAncestorRoute(navigation, 'Home', { screen: 'MainHome' })
  );
}
