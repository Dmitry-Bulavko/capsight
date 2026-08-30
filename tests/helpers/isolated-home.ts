/**
 * Point both HOME and USERPROFILE at the same directory so `os.homedir()` resolves
 * to an isolated temp home on every platform (Windows ignores HOME alone).
 */
export function setIsolatedHome(dir: string): void {
  process.env.HOME = dir;
  process.env.USERPROFILE = dir;
}

export function restoreIsolatedHome(previous: {
  home: string | undefined;
  userProfile: string | undefined;
}): void {
  if (previous.home === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = previous.home;
  }
  if (previous.userProfile === undefined) {
    delete process.env.USERPROFILE;
  } else {
    process.env.USERPROFILE = previous.userProfile;
  }
}

export function captureHomeEnv(): {
  home: string | undefined;
  userProfile: string | undefined;
} {
  return {
    home: process.env.HOME,
    userProfile: process.env.USERPROFILE,
  };
}
