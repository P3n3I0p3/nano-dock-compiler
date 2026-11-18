#!/bin/sh -ex
# Baut clang und lld (LLVM) mit AVR-Ziel als WebAssembly (WASI).
# Läuft in GitHub Actions (Ubuntu, x86_64); lokal ebenso auf Linux.
# Grundlage: Bauskript von YoWASP/clang (Apache 2.0), auf AVR und das Nötigste gekürzt.
#
# Ergebnis in dist/:
#   llvm.wasm          ein Programm für clang, ld.lld, llvm-objcopy, llvm-size, llvm-nm, llvm-ar
#   clang-include.tar  Header, die clang selbst mitbringt (stddef.h, stdarg.h …)

# LLVM 22.1.0 mit dem WASI-Patch von YoWASP ("Conditionalize use of POSIX features missing on
# WASI/WebAssembly"); das unveränderte LLVM lässt sich nicht für WASI einrichten.
LLVM_REPO=https://github.com/YoWASP/llvm-project.git
LLVM_COMMIT=97196c8eeb1d495fa43bb8af2fb26af5ef5b89fb
WASI_VER=29                 # dieselbe Version wie YoWASP
WASI_SDK=wasi-sdk-${WASI_VER}.0-x86_64-linux
WASI_SDK_URL=https://github.com/WebAssembly/wasi-sdk/releases/download/wasi-sdk-${WASI_VER}/${WASI_SDK}.tar.gz
JOBS=${JOBS:-$(nproc)}

if ! [ -d llvm-src ]; then
  git init -q llvm-src
  git -C llvm-src fetch --depth 1 "$LLVM_REPO" "$LLVM_COMMIT"
  git -C llvm-src checkout -q FETCH_HEAD
fi
if ! [ -d ${WASI_SDK} ]; then curl -fL ${WASI_SDK_URL} | tar xzf -; fi
WASI_SDK_PATH=$(pwd)/${WASI_SDK}
WASI_TARGET="wasm32-wasip1"

# Einstellungen wie bei YoWASP: LLVM ruft (in dieser Konfiguration nie erreichtes) mmap auf,
# braucht viel Speicher und Stack; LTO entfernt ungenutzte Thread-Funktionen.
# -include stdlib.h: einige LLVM-Dateien nutzen abort(), ohne stdlib.h einzubinden
CFLAGS="--sysroot ${WASI_SDK_PATH}/share/wasi-sysroot -mcpu=lime1 -D_WASI_EMULATED_MMAN -include stdlib.h -flto"
LDFLAGS="--sysroot ${WASI_SDK_PATH}/share/wasi-sysroot -lwasi-emulated-mman -Wl,--max-memory=4294967296"
LDFLAGS="${LDFLAGS} -Wl,-z,stack-size=8388608,--stack-first -flto -Wl,--strip-all"

cat >Toolchain-WASI.cmake <<END
set(CMAKE_SYSTEM_NAME WASI)
set(CMAKE_SYSTEM_VERSION 1)
set(CMAKE_SYSTEM_PROCESSOR wasm32)
set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_PACKAGE ONLY)
set(CMAKE_C_COMPILER ${WASI_SDK_PATH}/bin/clang)
set(CMAKE_C_COMPILER_TARGET ${WASI_TARGET})
set(CMAKE_CXX_COMPILER ${WASI_SDK_PATH}/bin/clang++)
set(CMAKE_CXX_COMPILER_TARGET ${WASI_TARGET})
set(CMAKE_LINKER ${WASI_SDK_PATH}/bin/wasm-ld)
set(CMAKE_AR ${WASI_SDK_PATH}/bin/ar)
set(CMAKE_RANLIB ${WASI_SDK_PATH}/bin/ranlib)
set(CMAKE_C_FLAGS "${CFLAGS}")
set(CMAKE_CXX_FLAGS "${CFLAGS}")
set(CMAKE_EXE_LINKER_FLAGS "${LDFLAGS}")
END

# 1. tblgen für den Bau-Rechner (erzeugt Quelltext während des Baus)
if ! [ -f llvm-tblgen-build/bin/llvm-tblgen -a -f llvm-tblgen-build/bin/clang-tblgen ]; then
  cmake -G Ninja -B llvm-tblgen-build -S llvm-src/llvm \
    -DCMAKE_BUILD_TYPE=Release \
    -DLLVM_TARGETS_TO_BUILD=AVR \
    -DLLVM_ENABLE_PROJECTS="clang" \
    -DLLVM_INCLUDE_TESTS=OFF -DLLVM_INCLUDE_EXAMPLES=OFF -DLLVM_INCLUDE_BENCHMARKS=OFF \
    -DLLVM_INCLUDE_DOCS=OFF -DLLVM_BUILD_TOOLS=OFF -DCLANG_INCLUDE_TESTS=OFF
  cmake --build llvm-tblgen-build -j "$JOBS" --target llvm-tblgen --target clang-tblgen
fi

# 2. LLVM als WebAssembly: nur AVR, nur die Werkzeuge, die die IDE braucht
cmake -G Ninja -B llvm-build -S llvm-src/llvm \
  -DCMAKE_TOOLCHAIN_FILE=../Toolchain-WASI.cmake \
  -DLLVM_NATIVE_TOOL_DIR=$(pwd)/llvm-tblgen-build/bin \
  -DCMAKE_BUILD_TYPE=MinSizeRel \
  -DLLVM_ENABLE_ASSERTIONS=OFF \
  -DLLVM_BUILD_SHARED_LIBS=OFF -DLLVM_ENABLE_PIC=OFF -DLLVM_BUILD_STATIC=ON \
  -DLLVM_ENABLE_THREADS=OFF \
  -DLLVM_TARGETS_TO_BUILD=AVR \
  -DLLVM_DEFAULT_TARGET_TRIPLE=avr \
  -DLLVM_ENABLE_PROJECTS="clang;lld" \
  -DLLVM_BUILD_RUNTIME=OFF -DLLVM_INCLUDE_RUNTIMES=OFF \
  -DLLVM_BUILD_TOOLS=OFF -DLLVM_INCLUDE_UTILS=OFF -DLLVM_BUILD_UTILS=OFF \
  -DLLVM_INCLUDE_EXAMPLES=OFF -DLLVM_INCLUDE_TESTS=OFF -DLLVM_INCLUDE_BENCHMARKS=OFF -DLLVM_INCLUDE_DOCS=OFF \
  -DLLVM_TOOL_LLVM_DRIVER_BUILD=ON \
  -DLLVM_TOOL_LLVM_AR_BUILD=ON \
  -DLLVM_TOOL_LLVM_NM_BUILD=ON \
  -DLLVM_TOOL_LLVM_OBJCOPY_BUILD=ON \
  -DLLVM_TOOL_LLVM_SIZE_BUILD=ON \
  -DLLVM_TOOL_LLVM_OBJDUMP_BUILD=OFF -DLLVM_TOOL_LLVM_READOBJ_BUILD=OFF \
  -DLLVM_TOOL_LLVM_DWARFDUMP_BUILD=OFF -DLLVM_TOOL_LLVM_SYMBOLIZER_BUILD=OFF \
  -DLLVM_TOOL_LLVM_CXXFILT_BUILD=OFF -DLLVM_TOOL_LLC_BUILD=OFF -DLLVM_TOOL_OPT_BUILD=OFF \
  -DLLVM_TOOL_LLI_BUILD=OFF -DLLVM_TOOL_LTO_BUILD=OFF -DLLVM_TOOL_GOLD_BUILD=OFF \
  -DLLVM_TOOL_BUGPOINT_BUILD=OFF -DLLVM_TOOL_DSYMUTIL_BUILD=OFF \
  -DCLANG_ENABLE_STATIC_ANALYZER=OFF \
  -DCLANG_INCLUDE_TESTS=OFF -DCLANG_BUILD_TOOLS=OFF -DCLANG_BUILD_EXAMPLES=OFF -DCLANG_INCLUDE_DOCS=OFF \
  -DCLANG_TOOL_CLANG_SCAN_DEPS_BUILD=OFF -DCLANG_TOOL_CLANG_INSTALLAPI_BUILD=OFF \
  -DLLD_BUILD_TOOLS=OFF \
  -DCLANG_RESOURCE_DIR=/clang
cmake --build llvm-build -j "$JOBS" --target llvm-driver
cmake --build llvm-build -j "$JOBS" --target clang-resource-headers

mkdir -p dist
cp llvm-build/bin/llvm dist/llvm.wasm
# clang sucht seine eigenen Header unter <resource-dir>/include
tar -C llvm-build/clang -cf dist/clang-include.tar include
ls -la dist
