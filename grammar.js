const PREC = {
  call: 8,
  unary: 7,
  multiplicative: 6,
  additive: 5,
  comparative: 4,
  equality: 3,
  logical_and: 2,
  logical_or: 1,
  assignment: 0,
};

module.exports = grammar({
  name: "pave",

  extras: $ => [
    /\s/,
    $.line_comment,
    $.block_comment,
  ],

  word: $ => $.identifier,

  rules: {
    source_file: $ => repeat($._item),

    _item: $ => choice(
      $.cpp_block,
      $.preproc_if,
      $.preproc_directive,
      $.module_directive,
      $.function_declaration,
      $.struct_declaration,
      $.enum_declaration,
      $.trait_declaration,
      $.impl_declaration,
      $.typedef_declaration,
      $.test_declaration,
      $.let_declaration,
      $.control_statement,
      $.expression_statement,
    ),

    line_comment: _ => token(seq("//", /.*/)),
    block_comment: _ => token(seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "/")),

    cpp_block: $ => prec.right(seq(
      alias("#cpp", $.preproc_directive),
      repeat($._item),
    )),

    preproc_directive: $ => seq(
      "#",
      "include",
      optional($._preproc_body),
    ),

    preproc_if: $ => seq(
      field("directive", alias(choice("#if", "#ifdef", "#ifndef"), $.preproc_directive)),
      optional(field("condition", alias($._preproc_body, $.preproc_condition))),
      repeat($._item),
      repeat($.preproc_elif),
      optional($.preproc_else),
      field("endif", alias("#endif", $.preproc_directive)),
    ),

    preproc_elif: $ => seq(
      alias("#elif", $.preproc_directive),
      optional(field("condition", alias($._preproc_body, $.preproc_condition))),
      repeat($._item),
    ),

    preproc_else: $ => seq(
      alias("#else", $.preproc_directive),
      repeat($._item),
    ),

    module_directive: $ => prec.right(seq(
      alias(choice("ns", "mod", "use"), $.keyword),
      repeat1(choice($.identifier, "::", ".", "*")),
      optional(";"),
    )),

    _preproc_body: _ => token.immediate(/[^\n]*/),

    function_declaration: $ => seq(
      field("keyword", alias(choice("fn", "co"), $.keyword)),
      field("name", $.identifier),
      field("parameters", $.parameter_list),
      optional(seq("->", $._type)),
      field("body", $.block),
    ),

    parameter_list: $ => seq(
      "(",
      optional(commaSep($.parameter)),
      ")",
    ),

    parameter: $ => seq(
      field("name", $.identifier),
      optional(seq(":", field("type", $._type))),
    ),

    struct_declaration: $ => seq(
      alias("struct", $.keyword),
      field("name", $.identifier),
      $.block,
    ),

    trait_declaration: $ => seq(
      alias("trait", $.keyword),
      field("name", $.identifier),
      $.block,
    ),

    enum_declaration: $ => seq(
      alias("enum", $.keyword),
      field("name", $.identifier),
      $.block,
    ),

    impl_declaration: $ => seq(
      alias("impl", $.keyword),
      field("name", $.identifier),
      $.block,
    ),

    typedef_declaration: $ => seq(
      alias("typedef", $.keyword),
      field("name", $.identifier),
      optional(seq("=", $._type)),
      optional(";"),
    ),

    test_declaration: $ => seq(
      alias("test", $.keyword),
      optional(field("name", choice($.identifier, $.string))),
      $.block,
    ),

    let_declaration: $ => seq(
      alias("let", $.keyword),
      optional(alias("static", $.keyword)),
      field("name", $.identifier),
      optional(seq(":", field("type", $._type))),
      optional(seq("=", field("value", $._expression))),
      optional(";"),
    ),

    control_statement: $ => choice(
      prec.right(seq(alias("return", $.keyword), optional($._expression), optional(";"))),
      prec.right(seq(alias("yield", $.keyword), optional($._expression), optional(";"))),
      prec.right(seq(alias("break", $.keyword), optional($._expression), optional(";"))),
      seq(alias("continue", $.keyword), optional(";")),
      prec(1, seq(alias("defer", $.keyword), $.block)),
      seq(alias("defer", $.keyword), $.expression_statement),
      seq(alias("if", $.keyword), $._expression, $.block, optional(seq(alias("else", $.keyword), choice($.block, $.control_statement)))),
      seq(alias("while", $.keyword), $._expression, $.block),
      seq(alias("for", $.keyword), $.identifier, alias("in", $.keyword), $._expression, $.block),
      seq(alias("match", $.keyword), $._expression, $.block),
    ),

    expression_statement: $ => seq($._expression, optional(";")),

    block: $ => seq("{", repeat($._item), "}"),

    _expression: $ => choice(
      $.identifier,
      $.boolean,
      $.number,
      $.string,
      $.char,
      $.null,
      $.self,
      $.call_expression,
      $.unary_expression,
      $.binary_expression,
      $.assignment_expression,
      $.parenthesized_expression,
      $.block,
    ),

    call_expression: $ => prec(PREC.call, seq(
      field("function", $.identifier),
      optional($.type_argument_list),
      field("arguments", $.argument_list),
    )),

    type_argument_list: $ => seq(
      "<",
      commaSep($._type),
      ">",
    ),

    argument_list: $ => seq(
      "(",
      optional(commaSep($._expression)),
      ")",
    ),

    unary_expression: $ => prec(PREC.unary, seq(
      field("operator", alias(choice("!", "-", "&", "*"), $.operator)),
      field("argument", $._expression),
    )),

    binary_expression: $ => choice(
      ...[
        [PREC.multiplicative, choice("*", "/", "%")],
        [PREC.additive, choice("+", "-")],
        [PREC.comparative, choice("<", "<=", ">", ">=")],
        [PREC.equality, choice("==", "!=")],
        [PREC.logical_and, "&&"],
        [PREC.logical_or, "||"],
        [PREC.assignment, "::"],
      ].map(([precedence, operator]) => prec.left(precedence, seq(
        field("left", $._expression),
        field("operator", alias(operator, $.operator)),
        field("right", $._expression),
      ))),
    ),

    assignment_expression: $ => prec.right(PREC.assignment, seq(
      field("left", $.identifier),
      field("operator", alias(choice("=", "+=", "-=", "*=", "/="), $.operator)),
      field("right", $._expression),
    )),

    parenthesized_expression: $ => seq("(", $._expression, ")"),

    _type: $ => choice(
      $.identifier,
      $.primitive_type,
      seq("*", $._type),
      seq("&", $._type),
      seq("[", $._type, optional(seq(";", $.number)), "]"),
    ),

    keyword: _ => choice(
      "as",
      "break",
      "co",
      "const",
      "continue",
      "defer",
      "dyn",
      "else",
      "enum",
      "export",
      "extern",
      "fn",
      "for",
      "if",
      "impl",
      "in",
      "let",
      "match",
      "mod",
      "mut",
      "ns",
      "pub",
      "return",
      "static",
      "struct",
      "test",
      "trait",
      "typedef",
      "type",
      "use",
      "where",
      "while",
      "yield",
    ),

    primitive_type: _ => choice(
      "bool",
      "char",
      "f32",
      "f64",
      "i8",
      "i16",
      "i32",
      "i64",
      "isize",
      "str",
      "u8",
      "u16",
      "u32",
      "u64",
      "usize",
      "void",
    ),

    boolean: _ => choice("true", "false"),
    null: _ => "null",
    self: _ => token(seq(optional("&"), "self")),
    identifier: _ => /[A-Za-z_][A-Za-z0-9_]*/,
    number: _ => token(choice(
      /0[xX][0-9A-Fa-f][0-9A-Fa-f_]*u?/,
      /0[bB][01][01_]*u?/,
      /[0-9][0-9_]*(\.[0-9][0-9_]*[fF]?|u)?/,
    )),
    string: _ => token(seq("\"", repeat(choice(
      seq("\\", choice(
        /[abfnrtv\\'"?]/,
        /[0-9][0-9][0-9]/,
        /x[0-9][0-9]/,
        "0",
      )),
      /[^"\\\n]/,
    )), "\"")),
    char: $ => seq("'", choice($.escape_sequence, /[^'\\]/), "'"),
    escape_sequence: _ => token(seq("\\", choice(
      /[abfnrtv\\'"?]/,
      /[0-9][0-9][0-9]/,
      /x[0-9][0-9]/,
      "0",
    ))),
    operator: _ => choice(
      "!",
      "!=",
      "%",
      "&&",
      "&",
      "*",
      "+",
      "+=",
      "-",
      "-=",
      "->",
      "=>",
      "/",
      "/=",
      "::",
      "<",
      "<=",
      "=",
      "==",
      ">",
      ">=",
      "||",
    ),
  },
});

function commaSep(rule) {
  return seq(rule, repeat(seq(",", rule)), optional(","));
}
