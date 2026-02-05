# Firebird Bridge – Architecture Guide

Este documento fotografa o estado **atual** do projeto e serve como referência rápida para navegação e padronização.

## Visão geral da arquitetura

Fluxo ponta a ponta:
- **Firebird (Dataweb)** → origem de dados e autenticação.
- **firebird-bridge (Railway)** → API Express que executa SQLs pré-definidos no Firebird.
- **Supabase/Lovable** → hospeda o frontend React (Lovable) que consome os endpoints REST do bridge.
- **Frontend** → dashboards e telas que leem apenas a API pública do Railway.

## Estrutura de pastas (back-end)

