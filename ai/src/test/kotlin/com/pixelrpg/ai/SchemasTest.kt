package com.pixelrpg.ai

import com.pixelrpg.engine.gen.HeroDraft
import com.pixelrpg.engine.gen.ItemDraft
import com.pixelrpg.engine.gen.LocationDraft
import com.pixelrpg.engine.gen.NpcDraft
import com.pixelrpg.engine.model.Canon
import com.pixelrpg.engine.turn.Adjudication
import com.pixelrpg.engine.turn.EffectSpec
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.descriptors.StructureKind
import kotlinx.serialization.descriptors.elementNames
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.fail

/** Схема для ИИ и модель данных должны совпадать поле в поле — иначе ответы молча теряются. */
class SchemasTest {

    private fun resolve(node: JsonObject, root: JsonObject): JsonObject {
        val ref = node["\$ref"]?.jsonPrimitive?.content ?: return node
        return root.getValue("\$defs").jsonObject.getValue(ref.substringAfterLast('/')).jsonObject
    }

    private fun check(schema: JsonObject, descriptor: SerialDescriptor, root: JsonObject, path: String) {
        val node = resolve(schema, root)
        when (node["type"]?.jsonPrimitive?.content) {
            "object" -> {
                val props = node.getValue("properties").jsonObject
                assertEquals(descriptor.elementNames.toSet(), props.keys, "fields at $path")
                assertEquals(props.keys, node.getValue("required").jsonArray.map { it.jsonPrimitive.content }.toSet(), "required at $path")
                assertEquals(JsonPrimitive(false), node["additionalProperties"], "additionalProperties at $path")
                descriptor.elementNames.forEachIndexed { i, name ->
                    check(props.getValue(name).jsonObject, descriptor.getElementDescriptor(i), root, "$path.$name")
                }
            }
            "array" -> {
                if (descriptor.kind != StructureKind.LIST) fail("$path: schema array, model ${descriptor.kind}")
                check(node.getValue("items").jsonObject, descriptor.getElementDescriptor(0), root, "$path[]")
            }
            else -> Unit
        }
    }

    @Test
    fun `schemas match the data model`() {
        check(Schemas.canon, Canon.serializer().descriptor, Schemas.canon, "canon")
        check(Schemas.hero, HeroDraft.serializer().descriptor, Schemas.hero, "hero")
        check(Schemas.location, LocationDraft.serializer().descriptor, Schemas.location, "location")
        check(Schemas.adjudication, Adjudication.serializer().descriptor, Schemas.adjudication, "adjudication")
    }

    @Test
    fun `nested defs match their classes`() {
        val defs = Schemas.location.getValue("\$defs").jsonObject
        check(defs.getValue("npc").jsonObject, NpcDraft.serializer().descriptor, Schemas.location, "npc")
        check(defs.getValue("item").jsonObject, ItemDraft.serializer().descriptor, Schemas.location, "item")
        val effect = Schemas.adjudication.getValue("\$defs").jsonObject.getValue("effect").jsonObject
        check(effect, EffectSpec.serializer().descriptor, Schemas.adjudication, "effect")
    }

    @Test
    fun `enums offered to the model are understood by the engine`() {
        val effectTypes = Schemas.adjudication.getValue("\$defs").jsonObject.getValue("effect").jsonObject
            .getValue("properties").jsonObject.getValue("type").jsonObject.getValue("enum") as JsonArray
        effectTypes.forEach { assert(com.pixelrpg.engine.turn.EffectType.parse(it.jsonPrimitive.content) != null) }
    }
}
