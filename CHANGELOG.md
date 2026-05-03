# Changelog

## [2.3.0](https://github.com/dbjpanda/convex-authz/compare/v2.2.0...v2.3.0) (2026-05-03)


### Features

* add addRelationUnified and removeRelationUnified with dual-write ([e96a11f](https://github.com/dbjpanda/convex-authz/commit/e96a11f82cb3524b84f6f2559e5a3795be54ca69))
* add addRelationUnified and removeRelationUnified with dual-write ([2f33951](https://github.com/dbjpanda/convex-authz/commit/2f33951b42d245dd90b2d6c1db1196e75423eb9d))
* add AI coding agent skill integration details to README and update sync script to exclude skill sections ([9f37d13](https://github.com/dbjpanda/convex-authz/commit/9f37d133104c12b79dec0428f8ece17fd6c7b1fe))
* add new convex-authz skill documentation with comprehensive authorization features and installation instructions ([ffa5997](https://github.com/dbjpanda/convex-authz/commit/ffa599768a3be28692ec54688734cb57025d456b))
* add recomputeUser for post-deploy effective table rebuild ([f070257](https://github.com/dbjpanda/convex-authz/commit/f070257cecdfeedfc9a7c71bcf8e38fe23cd2a0c))
* add recomputeUser for post-deploy effective table rebuild ([aa40fe8](https://github.com/dbjpanda/convex-authz/commit/aa40fe8b36913b1240dbcd7057a0504e8cbaa986))
* add revokeRoleUnified, grantPermissionUnified, denyPermissionUnified ([b498b75](https://github.com/dbjpanda/convex-authz/commit/b498b75dbb754947d95198596e5c7c6a4155ac60))
* add revokeRoleUnified, grantPermissionUnified, denyPermissionUnified ([41c4af6](https://github.com/dbjpanda/convex-authz/commit/41c4af6cc30515436773a675328bfbc73a9017b4))
* add setAttributeWithRecompute for static policy re-evaluation ([57a4c6f](https://github.com/dbjpanda/convex-authz/commit/57a4c6f08b8f8167b96ef2a4c4e2db6d44174fa9))
* add setAttributeWithRecompute for static policy re-evaluation ([fc4d147](https://github.com/dbjpanda/convex-authz/commit/fc4d14718dbc0bac35e7bc14ba8155361babd287))
* add transactional bulk mutations (assignRolesUnified, revokeRolesUnified, revokeAllRolesUnified) ([01d2289](https://github.com/dbjpanda/convex-authz/commit/01d2289a5909356fe93ed2c1279d6eec04c4feae))
* add transactional bulk mutations (assignRolesUnified, revokeRolesUnified, revokeAllRolesUnified) ([6aaf17d](https://github.com/dbjpanda/convex-authz/commit/6aaf17daca165e8a821df1e6fdaba7ced18500c4))
* add unified assignRoleUnified mutation ([af33d70](https://github.com/dbjpanda/convex-authz/commit/af33d7095a7d3420650ff592bb58884ccd4cef4a))
* add unified assignRoleUnified mutation ([9053fe8](https://github.com/dbjpanda/convex-authz/commit/9053fe8562dd6b09550f39ed7e50da3a96958a52))
* add unified tiered checkPermission query ([ee02db5](https://github.com/dbjpanda/convex-authz/commit/ee02db5a72cad8b000143880914e8b0140ff26bb))
* add unified tiered checkPermission query ([72b7a1e](https://github.com/dbjpanda/convex-authz/commit/72b7a1e77f5832e9c541f4b0740ad9ce045026a7))
* add v2 constructor options and definition helpers ([556112b](https://github.com/dbjpanda/convex-authz/commit/556112b3fdba8cfca9d96bdd4a76640ae6499160))
* add v2 constructor options and definition helpers ([e9a27de](https://github.com/dbjpanda/convex-authz/commit/e9a27dee16e9aabfea57f2c44bf00b5ebdf150d7))
* add v2 schema fields for ABAC policies and caveats ([d2b0d3f](https://github.com/dbjpanda/convex-authz/commit/d2b0d3f424d169acd9d3dc84f9ec1c852a800093))
* add v2 schema fields for ABAC policies and caveats ([a3f56ba](https://github.com/dbjpanda/convex-authz/commit/a3f56ba23dd692553a40aea83650b40fd659e4b6))
* add Vercel Skills marketplace SKILL.md for AI agent integration ([5aea222](https://github.com/dbjpanda/convex-authz/commit/5aea222bed53b6e86a20446fb237ccaf7d9d0ef9))
* auto-sync SKILL.md from README on every release via version hook ([1134e7a](https://github.com/dbjpanda/convex-authz/commit/1134e7aa0f3e23c247b97755fd6f5499f0d15588))
* implement ReBAC→permission bridge (addRelation grants permissions via relationPermissions) ([e827418](https://github.com/dbjpanda/convex-authz/commit/e827418f2a694b5540b0e564f7e7c94c4223cfca))
* implement ReBAC→permission bridge (addRelation grants permissions via relationPermissions) ([73b2557](https://github.com/dbjpanda/convex-authz/commit/73b2557024bacb800a6629b71b3e7c746c1d71d5))
* merge IndexedAuthz capabilities into unified Authz class ([fc1940a](https://github.com/dbjpanda/convex-authz/commit/fc1940af2b1be85b85ae381a167198cab455f8aa))
* merge IndexedAuthz capabilities into unified Authz class ([c12b36e](https://github.com/dbjpanda/convex-authz/commit/c12b36e9f2107d8a65418d12a176bd7aa6686288))
* transactional bulk mutations + schema/TS fixes ([bd25dd3](https://github.com/dbjpanda/convex-authz/commit/bd25dd3e10e3978b70189cab63bee49ddf3ae742))
* transactional bulk mutations + schema/TS fixes ([f7af6d2](https://github.com/dbjpanda/convex-authz/commit/f7af6d2f79faa0fc384d8bbcc9037c435874407c))
* type-safe permission strings — compile-time validation for can(), require(), grantPermission(), denyPermission(), canAny() ([03ce75a](https://github.com/dbjpanda/convex-authz/commit/03ce75afb7abdf1f8d82cf00598ff29c34167a5e))


### Bug Fixes

* add .take() bounds to all unbounded .collect() calls ([2cf73e4](https://github.com/dbjpanda/convex-authz/commit/2cf73e4f971780b38a3a246795ec2c7f93ee8143))
* add .take() bounds to all unbounded .collect() calls ([fe9f84e](https://github.com/dbjpanda/convex-authz/commit/fe9f84e2cf4882e6583018b81a063c7daea52fab))
* add maxBranching limit to ReBAC traversal ([0dcbc6a](https://github.com/dbjpanda/convex-authz/commit/0dcbc6a1e65c1ddab6c953ad7a4ea156d45ea81f))
* add maxBranching limit to ReBAC traversal ([8f2fca6](https://github.com/dbjpanda/convex-authz/commit/8f2fca634db69e57dbd9c7fb361840e2104b81ac))
* add missing audit action types to getAuditLog TypeScript cast ([33fc9cf](https://github.com/dbjpanda/convex-authz/commit/33fc9cffcb1d6893fe9bf3a8dfcf376367a9919c))
* add missing audit action types to getAuditLog TypeScript cast ([8a471d1](https://github.com/dbjpanda/convex-authz/commit/8a471d1c10e425e54f45304fd15470895da673b0))
* add missing PolicyContext method stubs in evaluatePolicyCondition test ([a1d51cb](https://github.com/dbjpanda/convex-authz/commit/a1d51cb11d75df324215e070d8a1026aae1c8723))
* add missing PolicyContext method stubs in evaluatePolicyCondition test ([caa581a](https://github.com/dbjpanda/convex-authz/commit/caa581a75a684576e12c43d6421f16342b858834))
* assignRolesUnified expiry extension now updates effective tables ([3d7f7a6](https://github.com/dbjpanda/convex-authz/commit/3d7f7a6f1aa8c15dcbdbb145dc560251dc1eb048))
* assignRolesUnified expiry extension now updates effective tables ([cdb6444](https://github.com/dbjpanda/convex-authz/commit/cdb6444292f2233874dd6238f7fe9b1ba9b514a1))
* build component before example in Vercel (resolves @djpanda/convex-authz/react import) ([0836385](https://github.com/dbjpanda/convex-authz/commit/08363857f574edd9fed2fae3822dbcc326006e54))
* cap MAX_BULK_ROLES at 20 to prevent Convex transaction limit overflow ([60db40e](https://github.com/dbjpanda/convex-authz/commit/60db40e0b1740b91d7a9c27df8a598505aa241b2))
* cap MAX_BULK_ROLES at 20 to prevent Convex transaction limit overflow ([7b8289c](https://github.com/dbjpanda/convex-authz/commit/7b8289c0b9466e1771c011be68105f9b5e5ff973))
* cast dynamic permission strings at Convex function boundary for PermissionArg&lt;P&gt; ([a534e5b](https://github.com/dbjpanda/convex-authz/commit/a534e5bd752d41fc73445e6035537320e7178752))
* change internal.* to api.* in example benchmark/test files (Convex app functions are public) ([177d153](https://github.com/dbjpanda/convex-authz/commit/177d153b0ddcc9ed7bbab3fb686030edff5ad3c7))
* change internal.* to api.* in example benchmark/test files (Convex app functions are public) ([5227c8f](https://github.com/dbjpanda/convex-authz/commit/5227c8f2792caf4b85f4a6526e1bf1fc923436e9))
* expiry extension updates effective tables, grantPermission clears policyResult ([0e1b621](https://github.com/dbjpanda/convex-authz/commit/0e1b62155e9550c6f62899e2bbdddba9787c5e65))
* expiry extension updates effective tables, grantPermission clears policyResult ([271db46](https://github.com/dbjpanda/convex-authz/commit/271db4601d510cd590751be1f7f894c501bbfe17))
* getStats N+1 query timeout + batched benchmark cleanup ([b1ff976](https://github.com/dbjpanda/convex-authz/commit/b1ff97650eee4f5fea8cd80755c74a5a86cc7024))
* getStats N+1 query timeout + batched benchmark cleanup ([31f70a4](https://github.com/dbjpanda/convex-authz/commit/31f70a415a9aad9e0a5da808b407f6a8d9b1e234))
* lint errors in type-safety tests ([00ed390](https://github.com/dbjpanda/convex-authz/commit/00ed390a1eb0663d3a47a95085ec72b089a70903))
* offboardUser preserves direct grant/deny effective rows when removeOverrides=false ([748e491](https://github.com/dbjpanda/convex-authz/commit/748e4910dcb91cb2543f41b825baa41053b58f0e))
* offboardUser preserves direct grant/deny effective rows when removeOverrides=false ([4d0207d](https://github.com/dbjpanda/convex-authz/commit/4d0207df883e6efeed45242cf3d2f7430607c3dd))
* recomputeUser policy propagation, removeAttribute re-evaluation, offboard tests ([ebfbaab](https://github.com/dbjpanda/convex-authz/commit/ebfbaab25e8eb7bd6db3bf5a1dc63d5efbb3dd69))
* recomputeUser policy propagation, removeAttribute re-evaluation, offboard tests ([096ad16](https://github.com/dbjpanda/convex-authz/commit/096ad1684ce4ab334a3bfee4d2b69c24d10d25a3))
* remove traversalRules/caveats from constructor test (options were removed) ([7d20038](https://github.com/dbjpanda/convex-authz/commit/7d20038ccb3cf1c0247e0c5f6fde6a610431405b))
* removeRelationUnified audit log uses proper userId instead of composite string ([6eebad6](https://github.com/dbjpanda/convex-authz/commit/6eebad6c668652bf77717c93dc9835a217fcc558))
* removeRelationUnified audit log uses proper userId instead of composite string ([d9758f0](https://github.com/dbjpanda/convex-authz/commit/d9758f09359749f4544f9e2c0eba14e769eb2d7d))
* resolve 5 bugs (static policies, error handling, PolicyContext, schema, bulk limits) ([0ddbf59](https://github.com/dbjpanda/convex-authz/commit/0ddbf593daf7c1cb9e0f5b8787a3e619ca729fdf))
* resolve 5 bugs (static policies, error handling, PolicyContext, schema, bulk limits) ([61a1534](https://github.com/dbjpanda/convex-authz/commit/61a1534483d3f4bdc507ba91abdf64bc14abf795))
* resolve 5 final bugs — scope equality, expiry merge, policy filter, revoke expired, collect bounds ([051e48a](https://github.com/dbjpanda/convex-authz/commit/051e48ab59bf9d16a17baf971979c1994f8d0e70))
* resolve 5 final bugs — scope equality, expiry merge, policy filter, revoke expired, collect bounds ([1ed79ea](https://github.com/dbjpanda/convex-authz/commit/1ed79ea221bf1bb3aec6d81d6b5e9b0ba4e328e2))
* resolve all critical and high severity bugs from final review ([188c8ec](https://github.com/dbjpanda/convex-authz/commit/188c8ec8c28099878eae6816e07e0d39b36d4d13))
* resolve all critical and high severity bugs from final review ([b86907a](https://github.com/dbjpanda/convex-authz/commit/b86907ab49870214daab6cb862069cb03c26e4d6))
* resolve critical split-brain bugs in unified Authz v2 ([a8c9e42](https://github.com/dbjpanda/convex-authz/commit/a8c9e42189a882d124740c2af3ac118f2c5036e0))
* resolve critical split-brain bugs in unified Authz v2 ([39d8e79](https://github.com/dbjpanda/convex-authz/commit/39d8e79839d36072db198b2b83252d790c3fff9d))
* resolve final review findings (policyClassifications, audit, expiresAt) ([8371db9](https://github.com/dbjpanda/convex-authz/commit/8371db96891bd2a7f9874ff3713004b60e64e440))
* resolve final review findings (policyClassifications, audit, expiresAt) ([dfed3f6](https://github.com/dbjpanda/convex-authz/commit/dfed3f673c252df9e0493a249edcf9a62476fb34))
* resolve merge conflict markers in README badges ([39ddfd3](https://github.com/dbjpanda/convex-authz/commit/39ddfd336c3a4109da834741b8f60b553f628400))
* resolve PermissionArg&lt;P&gt; type errors at Convex function boundaries ([75a7693](https://github.com/dbjpanda/convex-authz/commit/75a76937cd612e2df4a89ae08c52e54050e79a45))
* resolve remaining medium and low severity issues ([c56ff13](https://github.com/dbjpanda/convex-authz/commit/c56ff1357d00a1cb2e0ee3c024bce8adf7166bfb))
* resolve remaining medium and low severity issues ([9d03000](https://github.com/dbjpanda/convex-authz/commit/9d03000574cb5fbd8ef8becaa150392d33124325))
* resolve senior review findings — security, correctness, production safety ([139e072](https://github.com/dbjpanda/convex-authz/commit/139e07250c5e21873e18879091be4f65e71c19f7))
* resolve senior review findings — security, correctness, production safety ([c53bbf8](https://github.com/dbjpanda/convex-authz/commit/c53bbf8950ace8ab744971d5f37ba13c64964d77))
* restore O(1) fast path, fix policyClassifications propagation, add bulk mutation tests ([fd59753](https://github.com/dbjpanda/convex-authz/commit/fd59753ceb440c01a36d1d9a9c2038fb1b27a047))
* restore O(1) fast path, fix policyClassifications propagation, add bulk mutation tests ([94a26d9](https://github.com/dbjpanda/convex-authz/commit/94a26d90590c40cda56cb33f1268dd3d56b9d094))
* rewrite type-safety tests to use type-only assertions (no runtime calls) ([6760ca6](https://github.com/dbjpanda/convex-authz/commit/6760ca6dde5acdd3899014d8f22698dc0a37bca4))
* scope equality in overrides, .take() bounds in checkPermission, audit log validator ([695873b](https://github.com/dbjpanda/convex-authz/commit/695873b378848f665828574da871d63686abbf82))
* scope equality in overrides, .take() bounds in checkPermission, audit log validator ([ae256ac](https://github.com/dbjpanda/convex-authz/commit/ae256ac9635bfcfb976cfe6c80d658199d78c129))
* update example app return types for v2 getUserRoles shape ([0b9ae3f](https://github.com/dbjpanda/convex-authz/commit/0b9ae3f903dc11bc7e039f32b4f762555e75c966))
* update example app return types for v2 getUserRoles shape ([c5dd90c](https://github.com/dbjpanda/convex-authz/commit/c5dd90ceecb19d3d013a1f69c25f642a198c986c))
* update test files to use internal.* for internal functions ([fd135ba](https://github.com/dbjpanda/convex-authz/commit/fd135bab2b87fd84d9490d9e6c4e39d43de54bda))
* update test files to use internal.* for internal functions ([380c17a](https://github.com/dbjpanda/convex-authz/commit/380c17a73c571f9498f12c53f8d83dca8d9cc1af))
* wildcard deny override and expiresAt propagation bugs ([1bba82d](https://github.com/dbjpanda/convex-authz/commit/1bba82da945ef6d1b349925653ebdc0fdc3e315a))
* wildcard deny override and expiresAt propagation bugs ([6380c37](https://github.com/dbjpanda/convex-authz/commit/6380c378c7dccc3c0f1828def84d9f53dcacc282))


### Refactoring

* mark dead source-only mutations as internal ([c3faae4](https://github.com/dbjpanda/convex-authz/commit/c3faae42f5b32fd225e51198a840a96a40736458))
* mark dead source-only mutations as internal ([9ef077a](https://github.com/dbjpanda/convex-authz/commit/9ef077a8eb346f9ab930f12e9afb8fb186084e26))
* mark superseded component functions as internal ([ce6dc08](https://github.com/dbjpanda/convex-authz/commit/ce6dc08daa418029a37c2fbbece6e2ddd11880ec))
* mark superseded component functions as internal ([c4bf77e](https://github.com/dbjpanda/convex-authz/commit/c4bf77ebc66bed47b927dd79341a27751e350474))
* move component tests to src/component/tests/ subfolder ([3c1a8c1](https://github.com/dbjpanda/convex-authz/commit/3c1a8c133c008f817301ea3b66d39affb318f9bc))
* move component tests to src/component/tests/ subfolder ([5022f71](https://github.com/dbjpanda/convex-authz/commit/5022f716356e226e9cc413cb82c37669db94a5a4))
* remove all dead internal functions and IndexedAuthz alias ([e9f37bd](https://github.com/dbjpanda/convex-authz/commit/e9f37bde38521e556cca3611ebf06be75ce945ef))
* remove all dead internal functions and IndexedAuthz alias ([f6b9163](https://github.com/dbjpanda/convex-authz/commit/f6b91636fdd4904e1735065f079e56964f1128d7))
* remove detailed installation and setup instructions from SKILL.md to streamline content ([587bdc3](https://github.com/dbjpanda/convex-authz/commit/587bdc3fe3558999f8857c79c09fc9217b867a00))
* remove last 3 dead internalQuery functions from queries.ts ([b20a6d4](https://github.com/dbjpanda/convex-authz/commit/b20a6d44ad86ea890e014fba0e6a91b006c1a971))
* remove last 3 dead internalQuery functions from queries.ts ([af69cb7](https://github.com/dbjpanda/convex-authz/commit/af69cb7bde397404999899515d30b7a6a4b75b33))


### Documentation

* add note that IndexedAuthz import no longer works in v2 migration guide ([48f0461](https://github.com/dbjpanda/convex-authz/commit/48f046129ed42fe8ab179211128ef6249e853896))
* add note that IndexedAuthz import no longer works in v2 migration guide ([8db98dd](https://github.com/dbjpanda/convex-authz/commit/8db98ddc21ea1ed16da5f1b49e9db5b042d53577))
* add v2.1.0 changelog entry ([7405a46](https://github.com/dbjpanda/convex-authz/commit/7405a46cdbaa2aa4ec65064cc474d2c50a969730))
* add v2.1.1 changelog ([512c66d](https://github.com/dbjpanda/convex-authz/commit/512c66db9719410f9d558167ecda2d1b38387ee7))
* comprehensive v2.0.0 changelog covering all 67 commits ([e222b04](https://github.com/dbjpanda/convex-authz/commit/e222b0446aef975715ea3f72982c28c740cf9b2e))
* comprehensive v2.0.0 changelog covering all 67 commits ([813a189](https://github.com/dbjpanda/convex-authz/commit/813a1897b34e002f085b1a0ee18d5ad66d80da87))
* fix hasRelation call signature in O(1) example ([8c7c0f6](https://github.com/dbjpanda/convex-authz/commit/8c7c0f6bb498971bb3a3636667deef4631896dab))
* fix hasRelation call signature in O(1) example ([c485f44](https://github.com/dbjpanda/convex-authz/commit/c485f4456fab819e888aa8572ca9d2046bbcf016))
* fix README inaccuracies — bulk limits, definePolicies API, PolicyContext, IndexedAuthz removal, ReBAC bridge ([e33672d](https://github.com/dbjpanda/convex-authz/commit/e33672db465cfe39e6d2915b02f66cae9d25835f))
* fix README inaccuracies — bulk limits, definePolicies API, PolicyContext, IndexedAuthz removal, ReBAC bridge ([39605bd](https://github.com/dbjpanda/convex-authz/commit/39605bdddb44064633dcfe73fcb0c32e636c0842))
* fix remaining README inaccuracies — static policy doc, rebac API, IndexedAuthz ([a9e5284](https://github.com/dbjpanda/convex-authz/commit/a9e528438de9c23334066f95f042c4273e41d27a))
* fix remaining README inaccuracies — static policy doc, rebac API, IndexedAuthz ([3497881](https://github.com/dbjpanda/convex-authz/commit/3497881325b051c7d50cf69e1c69e33ff35cf44d))
* update CLAUDE.md for v2 unified architecture ([05597da](https://github.com/dbjpanda/convex-authz/commit/05597da243a37bf26602d4f9268615484e63bfe4))
* update CLAUDE.md for v2 unified architecture ([5837912](https://github.com/dbjpanda/convex-authz/commit/583791278a93cb8722784e8ddaa3bc3c35e93131))
* update README, CHANGELOG, and examples for v2.0 ([1cb8758](https://github.com/dbjpanda/convex-authz/commit/1cb8758502039b51ef43e13bfb286594588c4388))
* update README, CHANGELOG, and examples for v2.0 ([bde9b61](https://github.com/dbjpanda/convex-authz/commit/bde9b61421c6dd0ed56334f725f24f9edd97358e))

## [2.2.0](https://github.com/dbjpanda/convex-authz/compare/convex-authz-v2.1.1...convex-authz-v2.2.0) (2026-04-11)


### Features

* add addRelationUnified and removeRelationUnified with dual-write ([e96a11f](https://github.com/dbjpanda/convex-authz/commit/e96a11f82cb3524b84f6f2559e5a3795be54ca69))
* add addRelationUnified and removeRelationUnified with dual-write ([2f33951](https://github.com/dbjpanda/convex-authz/commit/2f33951b42d245dd90b2d6c1db1196e75423eb9d))
* add AI coding agent skill integration details to README and update sync script to exclude skill sections ([9f37d13](https://github.com/dbjpanda/convex-authz/commit/9f37d133104c12b79dec0428f8ece17fd6c7b1fe))
* add new convex-authz skill documentation with comprehensive authorization features and installation instructions ([ffa5997](https://github.com/dbjpanda/convex-authz/commit/ffa599768a3be28692ec54688734cb57025d456b))
* add recomputeUser for post-deploy effective table rebuild ([f070257](https://github.com/dbjpanda/convex-authz/commit/f070257cecdfeedfc9a7c71bcf8e38fe23cd2a0c))
* add recomputeUser for post-deploy effective table rebuild ([aa40fe8](https://github.com/dbjpanda/convex-authz/commit/aa40fe8b36913b1240dbcd7057a0504e8cbaa986))
* add revokeRoleUnified, grantPermissionUnified, denyPermissionUnified ([b498b75](https://github.com/dbjpanda/convex-authz/commit/b498b75dbb754947d95198596e5c7c6a4155ac60))
* add revokeRoleUnified, grantPermissionUnified, denyPermissionUnified ([41c4af6](https://github.com/dbjpanda/convex-authz/commit/41c4af6cc30515436773a675328bfbc73a9017b4))
* add setAttributeWithRecompute for static policy re-evaluation ([57a4c6f](https://github.com/dbjpanda/convex-authz/commit/57a4c6f08b8f8167b96ef2a4c4e2db6d44174fa9))
* add setAttributeWithRecompute for static policy re-evaluation ([fc4d147](https://github.com/dbjpanda/convex-authz/commit/fc4d14718dbc0bac35e7bc14ba8155361babd287))
* add transactional bulk mutations (assignRolesUnified, revokeRolesUnified, revokeAllRolesUnified) ([01d2289](https://github.com/dbjpanda/convex-authz/commit/01d2289a5909356fe93ed2c1279d6eec04c4feae))
* add transactional bulk mutations (assignRolesUnified, revokeRolesUnified, revokeAllRolesUnified) ([6aaf17d](https://github.com/dbjpanda/convex-authz/commit/6aaf17daca165e8a821df1e6fdaba7ced18500c4))
* add unified assignRoleUnified mutation ([af33d70](https://github.com/dbjpanda/convex-authz/commit/af33d7095a7d3420650ff592bb58884ccd4cef4a))
* add unified assignRoleUnified mutation ([9053fe8](https://github.com/dbjpanda/convex-authz/commit/9053fe8562dd6b09550f39ed7e50da3a96958a52))
* add unified tiered checkPermission query ([ee02db5](https://github.com/dbjpanda/convex-authz/commit/ee02db5a72cad8b000143880914e8b0140ff26bb))
* add unified tiered checkPermission query ([72b7a1e](https://github.com/dbjpanda/convex-authz/commit/72b7a1e77f5832e9c541f4b0740ad9ce045026a7))
* add v2 constructor options and definition helpers ([556112b](https://github.com/dbjpanda/convex-authz/commit/556112b3fdba8cfca9d96bdd4a76640ae6499160))
* add v2 constructor options and definition helpers ([e9a27de](https://github.com/dbjpanda/convex-authz/commit/e9a27dee16e9aabfea57f2c44bf00b5ebdf150d7))
* add v2 schema fields for ABAC policies and caveats ([d2b0d3f](https://github.com/dbjpanda/convex-authz/commit/d2b0d3f424d169acd9d3dc84f9ec1c852a800093))
* add v2 schema fields for ABAC policies and caveats ([a3f56ba](https://github.com/dbjpanda/convex-authz/commit/a3f56ba23dd692553a40aea83650b40fd659e4b6))
* add Vercel Skills marketplace SKILL.md for AI agent integration ([5aea222](https://github.com/dbjpanda/convex-authz/commit/5aea222bed53b6e86a20446fb237ccaf7d9d0ef9))
* auto-sync SKILL.md from README on every release via version hook ([1134e7a](https://github.com/dbjpanda/convex-authz/commit/1134e7aa0f3e23c247b97755fd6f5499f0d15588))
* implement ReBAC→permission bridge (addRelation grants permissions via relationPermissions) ([e827418](https://github.com/dbjpanda/convex-authz/commit/e827418f2a694b5540b0e564f7e7c94c4223cfca))
* implement ReBAC→permission bridge (addRelation grants permissions via relationPermissions) ([73b2557](https://github.com/dbjpanda/convex-authz/commit/73b2557024bacb800a6629b71b3e7c746c1d71d5))
* merge IndexedAuthz capabilities into unified Authz class ([fc1940a](https://github.com/dbjpanda/convex-authz/commit/fc1940af2b1be85b85ae381a167198cab455f8aa))
* merge IndexedAuthz capabilities into unified Authz class ([c12b36e](https://github.com/dbjpanda/convex-authz/commit/c12b36e9f2107d8a65418d12a176bd7aa6686288))
* transactional bulk mutations + schema/TS fixes ([bd25dd3](https://github.com/dbjpanda/convex-authz/commit/bd25dd3e10e3978b70189cab63bee49ddf3ae742))
* transactional bulk mutations + schema/TS fixes ([f7af6d2](https://github.com/dbjpanda/convex-authz/commit/f7af6d2f79faa0fc384d8bbcc9037c435874407c))
* type-safe permission strings — compile-time validation for can(), require(), grantPermission(), denyPermission(), canAny() ([03ce75a](https://github.com/dbjpanda/convex-authz/commit/03ce75afb7abdf1f8d82cf00598ff29c34167a5e))


### Bug Fixes

* add .take() bounds to all unbounded .collect() calls ([2cf73e4](https://github.com/dbjpanda/convex-authz/commit/2cf73e4f971780b38a3a246795ec2c7f93ee8143))
* add .take() bounds to all unbounded .collect() calls ([fe9f84e](https://github.com/dbjpanda/convex-authz/commit/fe9f84e2cf4882e6583018b81a063c7daea52fab))
* add maxBranching limit to ReBAC traversal ([0dcbc6a](https://github.com/dbjpanda/convex-authz/commit/0dcbc6a1e65c1ddab6c953ad7a4ea156d45ea81f))
* add maxBranching limit to ReBAC traversal ([8f2fca6](https://github.com/dbjpanda/convex-authz/commit/8f2fca634db69e57dbd9c7fb361840e2104b81ac))
* add missing audit action types to getAuditLog TypeScript cast ([33fc9cf](https://github.com/dbjpanda/convex-authz/commit/33fc9cffcb1d6893fe9bf3a8dfcf376367a9919c))
* add missing audit action types to getAuditLog TypeScript cast ([8a471d1](https://github.com/dbjpanda/convex-authz/commit/8a471d1c10e425e54f45304fd15470895da673b0))
* add missing PolicyContext method stubs in evaluatePolicyCondition test ([a1d51cb](https://github.com/dbjpanda/convex-authz/commit/a1d51cb11d75df324215e070d8a1026aae1c8723))
* add missing PolicyContext method stubs in evaluatePolicyCondition test ([caa581a](https://github.com/dbjpanda/convex-authz/commit/caa581a75a684576e12c43d6421f16342b858834))
* assignRolesUnified expiry extension now updates effective tables ([3d7f7a6](https://github.com/dbjpanda/convex-authz/commit/3d7f7a6f1aa8c15dcbdbb145dc560251dc1eb048))
* assignRolesUnified expiry extension now updates effective tables ([cdb6444](https://github.com/dbjpanda/convex-authz/commit/cdb6444292f2233874dd6238f7fe9b1ba9b514a1))
* build component before example in Vercel (resolves @djpanda/convex-authz/react import) ([0836385](https://github.com/dbjpanda/convex-authz/commit/08363857f574edd9fed2fae3822dbcc326006e54))
* cap MAX_BULK_ROLES at 20 to prevent Convex transaction limit overflow ([60db40e](https://github.com/dbjpanda/convex-authz/commit/60db40e0b1740b91d7a9c27df8a598505aa241b2))
* cap MAX_BULK_ROLES at 20 to prevent Convex transaction limit overflow ([7b8289c](https://github.com/dbjpanda/convex-authz/commit/7b8289c0b9466e1771c011be68105f9b5e5ff973))
* cast dynamic permission strings at Convex function boundary for PermissionArg&lt;P&gt; ([a534e5b](https://github.com/dbjpanda/convex-authz/commit/a534e5bd752d41fc73445e6035537320e7178752))
* change internal.* to api.* in example benchmark/test files (Convex app functions are public) ([177d153](https://github.com/dbjpanda/convex-authz/commit/177d153b0ddcc9ed7bbab3fb686030edff5ad3c7))
* change internal.* to api.* in example benchmark/test files (Convex app functions are public) ([5227c8f](https://github.com/dbjpanda/convex-authz/commit/5227c8f2792caf4b85f4a6526e1bf1fc923436e9))
* expiry extension updates effective tables, grantPermission clears policyResult ([0e1b621](https://github.com/dbjpanda/convex-authz/commit/0e1b62155e9550c6f62899e2bbdddba9787c5e65))
* expiry extension updates effective tables, grantPermission clears policyResult ([271db46](https://github.com/dbjpanda/convex-authz/commit/271db4601d510cd590751be1f7f894c501bbfe17))
* getStats N+1 query timeout + batched benchmark cleanup ([b1ff976](https://github.com/dbjpanda/convex-authz/commit/b1ff97650eee4f5fea8cd80755c74a5a86cc7024))
* getStats N+1 query timeout + batched benchmark cleanup ([31f70a4](https://github.com/dbjpanda/convex-authz/commit/31f70a415a9aad9e0a5da808b407f6a8d9b1e234))
* lint errors in type-safety tests ([00ed390](https://github.com/dbjpanda/convex-authz/commit/00ed390a1eb0663d3a47a95085ec72b089a70903))
* offboardUser preserves direct grant/deny effective rows when removeOverrides=false ([748e491](https://github.com/dbjpanda/convex-authz/commit/748e4910dcb91cb2543f41b825baa41053b58f0e))
* offboardUser preserves direct grant/deny effective rows when removeOverrides=false ([4d0207d](https://github.com/dbjpanda/convex-authz/commit/4d0207df883e6efeed45242cf3d2f7430607c3dd))
* recomputeUser policy propagation, removeAttribute re-evaluation, offboard tests ([ebfbaab](https://github.com/dbjpanda/convex-authz/commit/ebfbaab25e8eb7bd6db3bf5a1dc63d5efbb3dd69))
* recomputeUser policy propagation, removeAttribute re-evaluation, offboard tests ([096ad16](https://github.com/dbjpanda/convex-authz/commit/096ad1684ce4ab334a3bfee4d2b69c24d10d25a3))
* remove traversalRules/caveats from constructor test (options were removed) ([7d20038](https://github.com/dbjpanda/convex-authz/commit/7d20038ccb3cf1c0247e0c5f6fde6a610431405b))
* removeRelationUnified audit log uses proper userId instead of composite string ([6eebad6](https://github.com/dbjpanda/convex-authz/commit/6eebad6c668652bf77717c93dc9835a217fcc558))
* removeRelationUnified audit log uses proper userId instead of composite string ([d9758f0](https://github.com/dbjpanda/convex-authz/commit/d9758f09359749f4544f9e2c0eba14e769eb2d7d))
* resolve 5 bugs (static policies, error handling, PolicyContext, schema, bulk limits) ([0ddbf59](https://github.com/dbjpanda/convex-authz/commit/0ddbf593daf7c1cb9e0f5b8787a3e619ca729fdf))
* resolve 5 bugs (static policies, error handling, PolicyContext, schema, bulk limits) ([61a1534](https://github.com/dbjpanda/convex-authz/commit/61a1534483d3f4bdc507ba91abdf64bc14abf795))
* resolve 5 final bugs — scope equality, expiry merge, policy filter, revoke expired, collect bounds ([051e48a](https://github.com/dbjpanda/convex-authz/commit/051e48ab59bf9d16a17baf971979c1994f8d0e70))
* resolve 5 final bugs — scope equality, expiry merge, policy filter, revoke expired, collect bounds ([1ed79ea](https://github.com/dbjpanda/convex-authz/commit/1ed79ea221bf1bb3aec6d81d6b5e9b0ba4e328e2))
* resolve all critical and high severity bugs from final review ([188c8ec](https://github.com/dbjpanda/convex-authz/commit/188c8ec8c28099878eae6816e07e0d39b36d4d13))
* resolve all critical and high severity bugs from final review ([b86907a](https://github.com/dbjpanda/convex-authz/commit/b86907ab49870214daab6cb862069cb03c26e4d6))
* resolve critical split-brain bugs in unified Authz v2 ([a8c9e42](https://github.com/dbjpanda/convex-authz/commit/a8c9e42189a882d124740c2af3ac118f2c5036e0))
* resolve critical split-brain bugs in unified Authz v2 ([39d8e79](https://github.com/dbjpanda/convex-authz/commit/39d8e79839d36072db198b2b83252d790c3fff9d))
* resolve final review findings (policyClassifications, audit, expiresAt) ([8371db9](https://github.com/dbjpanda/convex-authz/commit/8371db96891bd2a7f9874ff3713004b60e64e440))
* resolve final review findings (policyClassifications, audit, expiresAt) ([dfed3f6](https://github.com/dbjpanda/convex-authz/commit/dfed3f673c252df9e0493a249edcf9a62476fb34))
* resolve merge conflict markers in README badges ([39ddfd3](https://github.com/dbjpanda/convex-authz/commit/39ddfd336c3a4109da834741b8f60b553f628400))
* resolve PermissionArg&lt;P&gt; type errors at Convex function boundaries ([75a7693](https://github.com/dbjpanda/convex-authz/commit/75a76937cd612e2df4a89ae08c52e54050e79a45))
* resolve remaining medium and low severity issues ([c56ff13](https://github.com/dbjpanda/convex-authz/commit/c56ff1357d00a1cb2e0ee3c024bce8adf7166bfb))
* resolve remaining medium and low severity issues ([9d03000](https://github.com/dbjpanda/convex-authz/commit/9d03000574cb5fbd8ef8becaa150392d33124325))
* resolve senior review findings — security, correctness, production safety ([139e072](https://github.com/dbjpanda/convex-authz/commit/139e07250c5e21873e18879091be4f65e71c19f7))
* resolve senior review findings — security, correctness, production safety ([c53bbf8](https://github.com/dbjpanda/convex-authz/commit/c53bbf8950ace8ab744971d5f37ba13c64964d77))
* restore O(1) fast path, fix policyClassifications propagation, add bulk mutation tests ([fd59753](https://github.com/dbjpanda/convex-authz/commit/fd59753ceb440c01a36d1d9a9c2038fb1b27a047))
* restore O(1) fast path, fix policyClassifications propagation, add bulk mutation tests ([94a26d9](https://github.com/dbjpanda/convex-authz/commit/94a26d90590c40cda56cb33f1268dd3d56b9d094))
* rewrite type-safety tests to use type-only assertions (no runtime calls) ([6760ca6](https://github.com/dbjpanda/convex-authz/commit/6760ca6dde5acdd3899014d8f22698dc0a37bca4))
* scope equality in overrides, .take() bounds in checkPermission, audit log validator ([695873b](https://github.com/dbjpanda/convex-authz/commit/695873b378848f665828574da871d63686abbf82))
* scope equality in overrides, .take() bounds in checkPermission, audit log validator ([ae256ac](https://github.com/dbjpanda/convex-authz/commit/ae256ac9635bfcfb976cfe6c80d658199d78c129))
* update example app return types for v2 getUserRoles shape ([0b9ae3f](https://github.com/dbjpanda/convex-authz/commit/0b9ae3f903dc11bc7e039f32b4f762555e75c966))
* update example app return types for v2 getUserRoles shape ([c5dd90c](https://github.com/dbjpanda/convex-authz/commit/c5dd90ceecb19d3d013a1f69c25f642a198c986c))
* update test files to use internal.* for internal functions ([fd135ba](https://github.com/dbjpanda/convex-authz/commit/fd135bab2b87fd84d9490d9e6c4e39d43de54bda))
* update test files to use internal.* for internal functions ([380c17a](https://github.com/dbjpanda/convex-authz/commit/380c17a73c571f9498f12c53f8d83dca8d9cc1af))
* wildcard deny override and expiresAt propagation bugs ([1bba82d](https://github.com/dbjpanda/convex-authz/commit/1bba82da945ef6d1b349925653ebdc0fdc3e315a))
* wildcard deny override and expiresAt propagation bugs ([6380c37](https://github.com/dbjpanda/convex-authz/commit/6380c378c7dccc3c0f1828def84d9f53dcacc282))


### Refactoring

* mark dead source-only mutations as internal ([c3faae4](https://github.com/dbjpanda/convex-authz/commit/c3faae42f5b32fd225e51198a840a96a40736458))
* mark dead source-only mutations as internal ([9ef077a](https://github.com/dbjpanda/convex-authz/commit/9ef077a8eb346f9ab930f12e9afb8fb186084e26))
* mark superseded component functions as internal ([ce6dc08](https://github.com/dbjpanda/convex-authz/commit/ce6dc08daa418029a37c2fbbece6e2ddd11880ec))
* mark superseded component functions as internal ([c4bf77e](https://github.com/dbjpanda/convex-authz/commit/c4bf77ebc66bed47b927dd79341a27751e350474))
* move component tests to src/component/tests/ subfolder ([3c1a8c1](https://github.com/dbjpanda/convex-authz/commit/3c1a8c133c008f817301ea3b66d39affb318f9bc))
* move component tests to src/component/tests/ subfolder ([5022f71](https://github.com/dbjpanda/convex-authz/commit/5022f716356e226e9cc413cb82c37669db94a5a4))
* remove all dead internal functions and IndexedAuthz alias ([e9f37bd](https://github.com/dbjpanda/convex-authz/commit/e9f37bde38521e556cca3611ebf06be75ce945ef))
* remove all dead internal functions and IndexedAuthz alias ([f6b9163](https://github.com/dbjpanda/convex-authz/commit/f6b91636fdd4904e1735065f079e56964f1128d7))
* remove detailed installation and setup instructions from SKILL.md to streamline content ([587bdc3](https://github.com/dbjpanda/convex-authz/commit/587bdc3fe3558999f8857c79c09fc9217b867a00))
* remove last 3 dead internalQuery functions from queries.ts ([b20a6d4](https://github.com/dbjpanda/convex-authz/commit/b20a6d44ad86ea890e014fba0e6a91b006c1a971))
* remove last 3 dead internalQuery functions from queries.ts ([af69cb7](https://github.com/dbjpanda/convex-authz/commit/af69cb7bde397404999899515d30b7a6a4b75b33))


### Documentation

* add note that IndexedAuthz import no longer works in v2 migration guide ([48f0461](https://github.com/dbjpanda/convex-authz/commit/48f046129ed42fe8ab179211128ef6249e853896))
* add note that IndexedAuthz import no longer works in v2 migration guide ([8db98dd](https://github.com/dbjpanda/convex-authz/commit/8db98ddc21ea1ed16da5f1b49e9db5b042d53577))
* add v2.1.0 changelog entry ([7405a46](https://github.com/dbjpanda/convex-authz/commit/7405a46cdbaa2aa4ec65064cc474d2c50a969730))
* add v2.1.1 changelog ([512c66d](https://github.com/dbjpanda/convex-authz/commit/512c66db9719410f9d558167ecda2d1b38387ee7))
* comprehensive v2.0.0 changelog covering all 67 commits ([e222b04](https://github.com/dbjpanda/convex-authz/commit/e222b0446aef975715ea3f72982c28c740cf9b2e))
* comprehensive v2.0.0 changelog covering all 67 commits ([813a189](https://github.com/dbjpanda/convex-authz/commit/813a1897b34e002f085b1a0ee18d5ad66d80da87))
* fix hasRelation call signature in O(1) example ([8c7c0f6](https://github.com/dbjpanda/convex-authz/commit/8c7c0f6bb498971bb3a3636667deef4631896dab))
* fix hasRelation call signature in O(1) example ([c485f44](https://github.com/dbjpanda/convex-authz/commit/c485f4456fab819e888aa8572ca9d2046bbcf016))
* fix README inaccuracies — bulk limits, definePolicies API, PolicyContext, IndexedAuthz removal, ReBAC bridge ([e33672d](https://github.com/dbjpanda/convex-authz/commit/e33672db465cfe39e6d2915b02f66cae9d25835f))
* fix README inaccuracies — bulk limits, definePolicies API, PolicyContext, IndexedAuthz removal, ReBAC bridge ([39605bd](https://github.com/dbjpanda/convex-authz/commit/39605bdddb44064633dcfe73fcb0c32e636c0842))
* fix remaining README inaccuracies — static policy doc, rebac API, IndexedAuthz ([a9e5284](https://github.com/dbjpanda/convex-authz/commit/a9e528438de9c23334066f95f042c4273e41d27a))
* fix remaining README inaccuracies — static policy doc, rebac API, IndexedAuthz ([3497881](https://github.com/dbjpanda/convex-authz/commit/3497881325b051c7d50cf69e1c69e33ff35cf44d))
* update CLAUDE.md for v2 unified architecture ([05597da](https://github.com/dbjpanda/convex-authz/commit/05597da243a37bf26602d4f9268615484e63bfe4))
* update CLAUDE.md for v2 unified architecture ([5837912](https://github.com/dbjpanda/convex-authz/commit/583791278a93cb8722784e8ddaa3bc3c35e93131))
* update README, CHANGELOG, and examples for v2.0 ([1cb8758](https://github.com/dbjpanda/convex-authz/commit/1cb8758502039b51ef43e13bfb286594588c4388))
* update README, CHANGELOG, and examples for v2.0 ([bde9b61](https://github.com/dbjpanda/convex-authz/commit/bde9b61421c6dd0ed56334f725f24f9edd97358e))

## v2.1.1

- Fix merge conflict markers in README badge section

## v2.1.0

### New features

- **Type-safe permission strings**: `can()`, `require()`, `canAny()`,
  `grantPermission()`, and `denyPermission()` now accept `PermissionArg<P>`
  instead of `string`. TypeScript catches typos like `"documets:read"` or
  `"documents:archive"` at compile time. Wildcards (`"documents:*"`, `"*:read"`,
  `"*"`) are also type-checked against defined resources and actions. New
  exported types: `PermissionString<P>`, `PermissionArg<P>`.

### Tests

- 7 new audit log consumer tests covering every action type: `role_revoked`,
  `permission_denied`, `attribute_set`, `relation_added`, `relation_removed`,
  action filtering, and entry detail verification. 663 total tests.

---

## v2.0.0

### BREAKING CHANGES

- **`IndexedAuthz` removed**: Use `Authz` instead. All IndexedAuthz
  functionality (O(1) reads, ReBAC, pre-computed permissions) is now built into
  the unified `Authz` class. `IndexedAuthz` is no longer exported.

- **`Authz.can()` now reads from effectivePermissions**: Permission checks are
  always O(1) via pre-computed effective tables. Existing `Authz` users must run
  `recomputeUser()` for each user to backfill effective tables after upgrading.

- **`tenantId` required in constructor**:
  `new Authz(component, { ..., tenantId: "my-app" })`. Single-tenant apps pass
  any constant string. Multi-tenant apps pass their org/tenant identifier.

- **All component function args require `tenantId`**: Every mutation, query, and
  ReBAC function now requires `tenantId`. Cleanup/cron mutations accept it as
  optional for global cleanup.

- **All indexes renamed to tenant-prefixed**: `by_user` → `by_tenant_user`,
  `by_role` → `by_tenant_role`, etc. Requires fresh deployment or data
  migration.

- **ReBAC methods use structured objects**: `hasRelation`, `addRelation`,
  `removeRelation` now take `{ type, id }` objects instead of positional string
  arguments.

- **Legacy component functions removed**: Source-only mutations
  (`mutations.assignRole`, `mutations.revokeRole`, `mutations.grantPermission`,
  `mutations.denyPermission`, etc.), old indexed write mutations
  (`indexed.assignRoleWithCompute`, etc.), old ReBAC mutations
  (`rebac.addRelation`, `rebac.removeRelation`), and old query-time permission
  evaluation (`queries.checkPermission`, `queries.checkPermissions`,
  `queries.getEffectivePermissions`) have all been deleted. Use the unified
  Authz client class instead.

- **`MAX_BULK_ROLES` reduced from 100 to 20**: Prevents Convex transaction limit
  overflow (20 roles × ~100 permission lookups = 2,000 db.query calls, safely
  within the 4,096 limit).

### New features

#### Unified Authz class

- Single `Authz` class replaces both `Authz` (scan-based) and `IndexedAuthz`
  (O(1)). All reads are O(1) by default via pre-computed `effectivePermissions`
  table. All writes dual-write to source and effective tables atomically.

#### Tiered permission resolution

- `can()` uses a three-step tiered resolution: (1) O(1) exact lookup in
  effectivePermissions, (2) global wildcard deny check, (3) wildcard pattern
  fallback. Deny always wins.

#### ReBAC → Permission bridge

- `defineRelationPermissions()` maps relationship types to permissions. When
  `addRelation` creates a relationship, it automatically writes scoped
  permissions to `effectivePermissions`. When `removeRelation` deletes a
  relationship, it revokes those permissions. This enables SpiceDB-style
  "relationships grant permissions" without separate `hasRelation()` calls.

#### ABAC deferred policies

- `canWithContext(ctx, userId, permission, scope?, requestContext?)` evaluates
  policies that depend on runtime context (IP address, time of day, request
  headers).
- `definePolicies()` accepts a `type` field (`"static"` or `"deferred"`). Both
  types are evaluated at read time when `can()` is called.
- `PolicyContext` includes `hasRole()`, `hasAttribute()`, `getAttribute()`, and
  `environment` helpers.
- `evaluatePolicyCondition()` now catches errors and returns `false`
  (fail-closed) instead of throwing.

#### Post-deploy rebuild

- `recomputeUser(ctx, userId)` rebuilds a user's effective tables from source
  tables. Use after role definition changes or schema migrations.

#### Cross-tenant operations

- `withTenant(tenantId)` returns a new Authz instance scoped to a different
  tenant for admin operations.

#### Transactional bulk mutations

- `assignRoles()`, `revokeRoles()`, `revokeAllRoles()` now use unified mutations
  that dual-write in a single Convex transaction (previously used two separate
  transactions).

#### Schema additions

- `effectivePermissions`: `policyResult` (`"allow"` | `"deny"` | `"deferred"`),
  `policyName`
- `effectiveRelationships`: `depth`
- `relationships`: `caveat`, `caveatContext`
- `auditLog` actions: `relation_added`, `relation_removed`, `policy_evaluated`
- `auditLog` details: `relation`, `subject`, `object` fields
- `effectivePermissions.effect`: tightened from `v.string()` to
  `v.union(v.literal("allow"), v.literal("deny"))`

#### Definition helpers

- `defineRelationPermissions()` — type-safe relation-to-permission mapping
- `defineTraversalRules()` — type-safe traversal rules for
  `checkRelationWithTraversal`
- `defineCaveats()` — type-safe caveat function definitions

### Bug fixes

- **Cleanup mutations use batched deletion**: `cleanupExpired`,
  `runScheduledCleanup`, `runAuditRetentionCleanup` no longer do full table
  scans. Use `.take(500)` batches to stay within Convex's 16,384 document scan
  limit.
- **ReBAC traversal has `maxBranching` limit**: `checkRelationWithTraversal`
  accepts `maxBranching` (default 50) to prevent exceeding the 4,096 db.query
  call limit on wide graphs.
- **All `.collect()` calls bounded**: Every database query uses `.take(N)` to
  prevent scan limit overflow. 46 unbounded collects fixed across 5 files.
- **Wildcard deny overrides exact allow**: A deny pattern like `"documents:*"`
  now correctly blocks `"documents:read"` even when an exact allow exists.
  Previously the exact match short-circuited before checking deny patterns.
- **`expiresAt` propagated to effectivePermissions**: Role assignments now
  correctly propagate expiry to effective permission rows. Previously, expired
  roles appeared as valid permissions.
- **`expiresAt` merge uses max/undefined-wins**: When two roles grant the same
  permission with different expiries, the effective row uses the later expiry
  (or no expiry if either source has none).
- **Expiry extension updates all tables**: Re-assigning a role with a later
  `expiresAt` now updates `roleAssignments`, `effectiveRoles`, AND
  `effectivePermissions` (previously only updated the source table).
- **`denyPermission` clears `directGrant` flag**: Prevents inconsistent state
  where a row has both `directGrant: true` and `directDeny: true`.
- **`grantPermission` clears `directDeny` and `policyResult`**: Explicit grant
  overrides any deny or policy result.
- **`revokeRole` preserves `directDeny` rows**: Revoking a role no longer
  accidentally deletes explicit deny overrides on shared permissions.
- **`offboardUser` preserves direct grant/deny effective rows**: When
  `removeOverrides=false`, effective permission rows with `directGrant` or
  `directDeny` survive offboarding (previously all effective rows were deleted).
- **`setAttributeWithRecompute` policy re-evaluation works across scopes**: No
  longer hardcoded to `scopeKey: "global"`.
- **`setAttributeWithRecompute` query hoisted outside loop**: Prevents N ×
  full-scan when re-evaluating multiple policies.
- **Scope equality in duplicate detection**: `assignRole`, `revokeRole`,
  `grantPermission`, `denyPermission` now use exact scope equality
  (`scopeEquals`) for duplicate detection instead of asymmetric `matchesScope`.
- **Global wildcard deny checked for scoped permissions**: A global
  `denyPermission("documents:*")` now correctly blocks scoped permission checks.
- **`removeAttribute` triggers policy re-evaluation**: Previously only
  `setAttribute` re-evaluated policies.
- **Audit log uses proper `userId` for ReBAC**: `addRelation`/`removeRelation`
  audit entries use the subject's ID (not a composite string) when the subject
  is a user.
- **`auditLogActionValidator` includes all action types**: `getAuditLog` now
  accepts `"relation_added"`, `"relation_removed"`, and `"policy_evaluated"` as
  filter values.
- **`getAuditLog` TypeScript cast includes all action types**: IntelliSense now
  shows all valid audit action filter values.

### Code cleanup

- **Dead code removed**: 1,837+ lines of dead functions deleted — 11 source-only
  mutations from `mutations.ts`, 8 indexed write mutations from `indexed.ts`, 2
  ReBAC mutations from `rebac.ts`, 3 internal queries from `queries.ts`, 8
  unused helper functions from `helpers.ts`. `helpers.ts` reduced from 244 to 73
  lines.
- **`IndexedAuthz` export removed**: No longer exported from
  `src/client/index.ts`.
- **Unused constructor options removed**: `traversalRules` and `caveats` removed
  from Authz constructor (were accepted but never used). `defineTraversalRules`
  and `defineCaveats` remain as exported helpers for direct component API usage.
- **Shared `scopeValidator`**: Extracted into `src/component/validators.ts`,
  removing ~30 inline duplicates.
- **Test files organized**: All component tests moved to `src/component/tests/`
  subfolder.

### Testing

- **648 tests** across 21 test files
- **40 consumer integration tests**: Full Authz class → real convexTest DB path,
  covering RBAC, role inheritance, deferred policies, scoped permissions,
  cross-tenant isolation, grant/deny interactions, bulk operations, ReBAC with
  permission bridge, wildcards, expiry, offboarding, audit log, and more
- **67 live feature tests**: All features verified against real Convex backend
  with 10K users
- **126 exhaustive invariant tests**: Every write→read interaction, every
  operation pair, every edge case
- **Real-world benchmarks**: 1ms permission checks at 10K user scale on
  production Convex infrastructure

### Migration guide

1. Replace `IndexedAuthz` with `Authz` — same constructor, just rename the
   import.
2. Add `tenantId` to your constructor:
   ```typescript
   const authz = new Authz(components.authz, {
     permissions,
     roles,
     tenantId: "my-app",
   });
   ```
3. Run `recomputeUser()` for each existing user to backfill effective tables:
   ```typescript
   for (const user of users) {
     await authz.recomputeUser(ctx, String(user._id));
   }
   ```
4. If you access component functions directly, they no longer exist as public
   exports. Use the Authz client methods instead.
5. Update `hasRelation`/`addRelation`/`removeRelation` calls from positional
   args to structured objects:
   ```typescript
   // Before
   await authz.hasRelation(ctx, "user", userId, "member", "team", teamId);
   // After
   await authz.hasRelation(ctx, { type: "user", id: userId }, "member", {
     type: "team",
     id: teamId,
   });
   ```

### Performance

Benchmarked on real Convex backend with 10,000 users:

| Operation                          | Median latency |
| ---------------------------------- | -------------- |
| `can()` (permission check)         | **1ms**        |
| `checkAllPermissions()` (11 perms) | **1ms**        |
| `assignRole()`                     | 48-68ms        |
| `revokeRole()`                     | 49ms           |
| `grantPermission()`                | 36-39ms        |
| `denyPermission()`                 | 37ms           |

Read latency is constant regardless of data size (O(1) indexed lookups).

---

## 0.1.7

- Role inheritance and composition: Roles support `inherits` (single parent) and
  `includes` (multiple roles) with cycle detection
- Permission definition merging: `definePermissions()` and `defineRoles()`
  accept multiple objects
- Coverage reporting with `@vitest/coverage-v8`
- Improved type safety with `ReadonlyArray` in role definitions

## 0.1.4

- Real-world scenario tests (Google Drive, Food Delivery, multi-org)
- Example UI with shadcn/ui components, sidebar navigation, dashboard
- Seed script with demo data
- Permission Tester and Users & Roles management pages
