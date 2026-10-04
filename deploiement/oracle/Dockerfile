# L'image du serveur de jeu sur la machine Oracle (etape 5.9).
#
# Elle se construit SUR LA MACHINE, a partir des sources du commit que la CI lui
# envoie (deploiement/oracle.ts): la machine est un processeur Arm, et la construire
# la evite d'emuler Arm sur les machines de GitHub. Le contexte de construction est
# l'archive du commit, sans historique git: la version et sa date arrivent donc en
# arguments.
#
# Le serveur sert lui-meme la page de l'essai (SERVIR_LA_PAGE), empaquetee pour ce
# commit: elle porte sa version, sans quoi le serveur la refuserait, et ne joint que
# son propre hebergement.

FROM node:24-bookworm-slim

# corepack installe la version de pnpm du champ packageManager, sans poser de question.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

WORKDIR /jeu
COPY . .

# Le magasin de pnpm se garde d'une construction a l'autre: une mise a jour qui ne
# change pas les dependances ne les retelecharge pas.
RUN --mount=type=cache,id=pnpm,target=/root/.cache/pnpm \
    pnpm config set store-dir /root/.cache/pnpm/store \
    && pnpm install --frozen-lockfile \
    && pnpm exec tsc --build

ARG VERSION_DU_JEU
ARG HORODATAGE_DU_JEU=
RUN test -n "$VERSION_DU_JEU" \
    && VERSION_DU_JEU="$VERSION_DU_JEU" HORODATAGE_DU_JEU="$HORODATAGE_DU_JEU" \
       pnpm --filter @neon-ninja/client empaqueter

ENV NODE_ENV=production \
    SERVIR_LA_PAGE=oui \
    VERSION_DU_JEU=$VERSION_DU_JEU

# Le serveur ne tourne pas en administrateur.
USER node

# Comme sur Render: les migrations de la base d'abord, puis le serveur.
CMD ["sh", "-c", "node packages/server/dist/base/migrer.js && exec node packages/server/dist/principal.js"]
